import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { 
  Booking, 
  BookingWithDetails, 
  BookingVehicle, 
  BookingRequestedVehicle,
  BookingAuditLog,
  AvailableCar,
  BookingStatus,
  TripType,
  RateType,
  Invoice
} from '@/types/booking';

// Buffer minutes for availability check
const BUFFER_MINUTES = 60;

/**
 * Automatically update booking status based on current time and trip dates.
 * - If booking is cancelled, status is never changed.
 * - If now >= end_at -> completed
 * - If start_at <= now < end_at -> ongoing
 * - Otherwise status is left as-is
 *
 * This keeps statuses in sync without requiring manual edits.
 */
async function autoUpdateBookingStatuses(bookings: any[]) {
  if (!bookings || bookings.length === 0) return;

  const now = new Date();
  const updatesByStatus: Partial<Record<BookingStatus, string[]>> = {};

  for (const b of bookings) {
    if (!b.start_at || !b.end_at) continue;

    // Never auto-change cancelled bookings
    if (b.status === 'cancelled') continue;

    const start = new Date(b.start_at);
    const end = new Date(b.end_at);

    let newStatus: BookingStatus | null = null;

    if (now >= end && b.status !== 'completed') {
      newStatus = 'completed';
    } else if (now >= start && now < end && b.status !== 'ongoing') {
      // Consider only active bookings for ongoing
      if (b.status === 'confirmed' || b.status === 'inquiry' || b.status === 'tentative' || b.status === 'ongoing') {
        newStatus = 'ongoing';
      }
    }

    if (newStatus && newStatus !== b.status) {
      if (!updatesByStatus[newStatus]) updatesByStatus[newStatus] = [];
      updatesByStatus[newStatus]!.push(b.id);
      // Also update the in-memory object so UI reflects change immediately
      b.status = newStatus;
    }
  }

  // Persist changes to the database, grouped by status
  const statusEntries = Object.entries(updatesByStatus) as [BookingStatus, string[]][];
  for (const [status, ids] of statusEntries) {
    if (ids.length === 0) continue;
    await supabase
      .from('bookings')
      .update({ status })
      .in('id', ids);
  }
}

// Fetch all bookings with details
export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      // First, fetch bookings with vehicles
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_vehicles(
            *,
            cars(id, vehicle_number, model, seats, vehicle_class)
          )
        `)
        .order('start_at', { ascending: false });

      if (bookingsError) throw bookingsError;
      if (!bookingsData) return [];

      // Auto-update statuses based on current time and trip dates
      await autoUpdateBookingStatuses(bookingsData);

      // Fetch requested vehicles separately to avoid query issues
      const bookingIds = bookingsData.map(b => b.id);
      let requestedVehiclesMap: Record<string, any[]> = {};
      
      if (bookingIds.length > 0) {
        const { data: requestedVehicles } = await supabase
          .from('booking_requested_vehicles')
          .select('*')
          .in('booking_id', bookingIds);
        
        if (requestedVehicles) {
          requestedVehiclesMap = requestedVehicles.reduce((acc, rv) => {
            if (!acc[rv.booking_id]) acc[rv.booking_id] = [];
            acc[rv.booking_id].push(rv);
            return acc;
          }, {} as Record<string, any[]>);
        }
      }
      
      // Fetch profile names for created_by/updated_by
      const userIds = [...new Set([
        ...bookingsData.map(b => b.created_by).filter(Boolean),
        ...bookingsData.map(b => b.updated_by).filter(Boolean)
      ])];
      
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }
      
      return bookingsData.map(b => ({
        ...b,
        created_by_profile: b.created_by ? { name: profileMap[b.created_by] || 'Unknown' } : null,
        updated_by_profile: b.updated_by ? { name: profileMap[b.updated_by] || 'Unknown' } : null,
        booking_vehicles: b.booking_vehicles?.map((v: any) => ({
          ...v,
          car: v.cars || null,
        })) || [],
        booking_requested_vehicles: requestedVehiclesMap[b.id] || [],
      })) as unknown as BookingWithDetails[];
    },
  });
}

// Fetch single booking with full details
export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      if (!id) return null;
      
      // Fetch booking with vehicles
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_vehicles(
            *,
            cars(id, vehicle_number, model, seats, vehicle_class)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Auto-update status for this single booking
      await autoUpdateBookingStatuses([data]);

      // Fetch requested vehicles separately
      const { data: requestedVehicles } = await supabase
        .from('booking_requested_vehicles')
        .select('*')
        .eq('booking_id', id);

      // Fetch profile names
      const userIds = [...new Set([
        data.created_by,
        data.updated_by,
        ...(data.booking_vehicles || []).map((v: any) => v.created_by).filter(Boolean),
        ...(data.booking_vehicles || []).map((v: any) => v.updated_by).filter(Boolean)
      ].filter(Boolean))];
      
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }
      
      return {
        ...data,
        created_by_profile: data.created_by ? { name: profileMap[data.created_by] || 'Unknown' } : null,
        updated_by_profile: data.updated_by ? { name: profileMap[data.updated_by] || 'Unknown' } : null,
        booking_vehicles: (data.booking_vehicles || []).map((v: any) => ({
          ...v,
          car: v.cars || null,
          created_by_profile: v.created_by ? { name: profileMap[v.created_by] || 'Unknown' } : null,
          updated_by_profile: v.updated_by ? { name: profileMap[v.updated_by] || 'Unknown' } : null,
        })),
        booking_requested_vehicles: requestedVehicles || [],
      } as unknown as BookingWithDetails;
    },
    enabled: !!id,
  });
}

// Fetch bookings for calendar (date range)
export function useBookingsForCalendar(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['bookings-calendar', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_vehicles(
            *,
            cars(id, vehicle_number, model, seats, vehicle_class)
          ),
          booking_requested_vehicles(id, brand, model)
        `)
        .gte('end_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .neq('status', 'cancelled');

      if (error) throw error;
      
      // Fetch profile names for created_by
      const userIds = [...new Set(data.map(b => b.created_by).filter(Boolean))];
      
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }
      
      return data.map(b => ({
        ...b,
        created_by_profile: b.created_by ? { name: profileMap[b.created_by] || 'Unknown' } : null,
      })) as unknown as BookingWithDetails[];
    },
    staleTime: 60000, // 1 minute
  });
}

// Check available cars for a date range
export function useAvailableCars(startAt: Date | null, endAt: Date | null, excludeBookingId?: string) {
  return useQuery({
    queryKey: ['available-cars', startAt?.toISOString(), endAt?.toISOString(), excludeBookingId],
    queryFn: async () => {
      if (!startAt || !endAt) return [];
      
      const { data, error } = await supabase.rpc('check_available_cars', {
        p_start_at: startAt.toISOString(),
        p_end_at: endAt.toISOString(),
        p_buffer_minutes: BUFFER_MINUTES,
        p_exclude_booking_id: excludeBookingId || null,
      });

      if (error) throw error;
      return data as AvailableCar[];
    },
    enabled: !!startAt && !!endAt && startAt < endAt,
    staleTime: 60000, // Cache for 1 minute
  });
}

// Create booking mutation
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      customer_name: string;
      customer_phone: string;
      trip_type: TripType;
      start_at: string;
      end_at: string;
      pickup?: string;
      dropoff?: string;
      notes?: string;
      status?: BookingStatus;
      advance_amount?: number;
      advance_payment_method?: 'cash' | 'online' | null;
      advance_collected_by?: string | null;
      advance_account_type?: 'company' | 'personal' | null;
      advance_account_id?: string | null;
      custom_attributes?: Record<string, string | number | boolean | null>;
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { custom_attributes, ...rest } = data;
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          ...rest,
          organization_id: orgId,
          created_by: userId,
          updated_by: userId,
          custom_attributes: custom_attributes ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('booking_audit_log').insert({
        organization_id: orgId,
        booking_id: booking.id,
        action: 'created',
        after: booking,
        actor_id: userId,
      });

      if (data.status === 'tentative') {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);
        await supabase.from('tentative_holds').insert({
          organization_id: orgId,
          booking_id: booking.id,
          expires_at: expiresAt.toISOString(),
        });
      }

      return booking as Booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
      toast.success('Booking created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create booking: ${error.message}`);
    },
  });
}

// Update booking mutation
export function useUpdateBooking() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Booking> & { 
      id: string;
      advance_amount?: number;
      advance_payment_method?: 'cash' | 'online' | null;
      advance_collected_by?: string | null;
      advance_account_type?: 'company' | 'personal' | null;
      advance_account_id?: string | null;
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: before } = await supabase
        .from('bookings')
        .select()
        .eq('id', id)
        .single();

      const { data: booking, error } = await supabase
        .from('bookings')
        .update({
          ...data,
          updated_by: userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      let action: 'updated' | 'status_changed' | 'date_changed' = 'updated';
      if (before?.status !== booking.status) action = 'status_changed';
      else if (before?.start_at !== booking.start_at || before?.end_at !== booking.end_at) action = 'date_changed';

      await supabase.from('booking_audit_log').insert({
        organization_id: orgId,
        booking_id: booking.id,
        action,
        before,
        after: booking,
        actor_id: userId,
      });

      return booking as Booking;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings-calendar'] });
      toast.success('Booking updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update booking: ${error.message}`);
    },
  });
}

// Assign vehicle to booking
export function useAssignVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      booking_id: string;
      car_id: string;
      driver_name?: string;
      driver_phone?: string;
      rate_type: RateType;
      rate_total?: number;
      rate_per_day?: number;
      rate_per_km?: number;
      estimated_km?: number;
      advance_amount?: number;
      requested_vehicle_id?: string | null;
    }) => {
      const { data: result, error } = await supabase.rpc('assign_car_to_booking', {
        p_booking_id: data.booking_id,
        p_car_id: data.car_id,
        p_driver_name: data.driver_name || null,
        p_driver_phone: data.driver_phone || null,
        p_rate_type: data.rate_type,
        p_rate_total: data.rate_total || null,
        p_rate_per_day: data.rate_per_day || null,
        p_rate_per_km: data.rate_per_km || null,
        p_estimated_km: data.estimated_km || null,
        p_advance_amount: data.advance_amount || 0,
        p_buffer_minutes: BUFFER_MINUTES,
        p_requested_vehicle_id: data.requested_vehicle_id || null,
      });

      if (error) throw error;
      
      const response = result as { success: boolean; error?: string; vehicle_id?: string; computed_total?: number };
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to assign vehicle');
      }

      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['available-cars'] });
      toast.success('Vehicle assigned successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Remove vehicle from booking
export function useRemoveVehicle() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ vehicleId, bookingId }: { vehicleId: string; bookingId: string }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: vehicle } = await supabase
        .from('booking_vehicles')
        .select('*, cars(vehicle_number)')
        .eq('id', vehicleId)
        .single();

      const { error } = await supabase
        .from('booking_vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      await supabase.from('booking_audit_log').insert({
        organization_id: orgId,
        booking_id: bookingId,
        action: 'vehicle_removed',
        before: vehicle,
        actor_id: userId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['available-cars'] });
      toast.success('Vehicle removed from booking');
    },
    onError: (error) => {
      toast.error(`Failed to remove vehicle: ${error.message}`);
    },
  });
}

// Fetch audit log for a booking
export function useBookingAuditLog(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['booking-audit-log', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      
      const { data, error } = await supabase
        .from('booking_audit_log')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch actor names separately
      const actorIds = [...new Set(data.map(d => d.actor_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', actorIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      return data.map(log => ({
        ...log,
        actor: log.actor_id ? { name: profileMap.get(log.actor_id) || 'Unknown' } : null
      })) as (BookingAuditLog & { actor?: { name: string } | null })[];
    },
    enabled: !!bookingId,
  });
}

// Generate invoice for a booking
export function useGenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      // Get booking with vehicles
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_vehicles(computed_total, rate_total, advance_amount)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Calculate totals
      const vehicles = booking.booking_vehicles || [];
      const amountTotal = vehicles.reduce((sum: number, v: BookingVehicle) => 
        sum + (v.computed_total || v.rate_total || 0), 0);
      const advanceAmount = vehicles.reduce((sum: number, v: BookingVehicle) => 
        sum + (v.advance_amount || 0), 0);
      const amountDue = amountTotal - advanceAmount;

      // Check if invoice exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select()
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (existingInvoice) {
        // Update existing
        const { data: invoice, error } = await supabase
          .from('invoices')
          .update({
            amount_total: amountTotal,
            advance_amount: advanceAmount,
            amount_due: amountDue,
          })
          .eq('id', existingInvoice.id)
          .select()
          .single();

        if (error) throw error;
        return invoice as Invoice;
      }

      // Create new invoice (organization_id required for tenant isolation)
      const orgId = (booking as { organization_id?: string })?.organization_id;
      if (!orgId) throw new Error('Booking has no organization');

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          organization_id: orgId,
          booking_id: bookingId,
          amount_total: amountTotal,
          advance_amount: advanceAmount,
          amount_due: amountDue,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return invoice as Invoice;
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      toast.success('Invoice generated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to generate invoice: ${error.message}`);
    },
  });
}

// Fetch invoice for a booking
export function useInvoice(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['invoice', bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Fetch creator name separately
      let creatorName = null;
      if (data.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.created_by)
          .single();
        creatorName = profile?.name;
      }
      
      return {
        ...data,
        created_by_profile: creatorName ? { name: creatorName } : null
      } as Invoice & { created_by_profile?: { name: string } | null };
    },
    enabled: !!bookingId,
  });
}

// Fetch requested vehicles for a booking
export function useBookingRequestedVehicles(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['booking-requested-vehicles', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];

      const { data, error } = await supabase
        .from('booking_requested_vehicles')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as BookingRequestedVehicle[];
    },
    enabled: !!bookingId,
  });
}

// Create requested vehicle
export function useCreateRequestedVehicle() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      booking_id: string;
      brand: string;
      model: string;
      rate_type: RateType;
      rate_total?: number | null;
      rate_per_day?: number | null;
      rate_per_km?: number | null;
      estimated_km?: number | null;
      driver_allowance_per_day?: number | null;
      advance_amount?: number;
      advance_payment_method?: 'cash' | 'online' | null;
      advance_collected_by?: string | null;
      advance_account_type?: 'company' | 'personal' | null;
      advance_account_id?: string | null;
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: requestedVehicle, error } = await supabase
        .from('booking_requested_vehicles')
        .insert({
          organization_id: orgId,
          booking_id: data.booking_id,
          brand: data.brand,
          model: data.model,
          rate_type: data.rate_type,
          rate_total: data.rate_total || null,
          rate_per_day: data.rate_per_day || null,
          rate_per_km: data.rate_per_km || null,
          estimated_km: data.estimated_km || null,
          driver_allowance_per_day: data.driver_allowance_per_day || null,
          advance_amount: data.advance_amount || 0,
          advance_payment_method: data.advance_payment_method || null,
          advance_collected_by: data.advance_collected_by || null,
          advance_account_type: data.advance_account_type || null,
          advance_account_id: data.advance_account_id || null,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return requestedVehicle as BookingRequestedVehicle;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['booking-requested-vehicles', variables.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.booking_id] });
      toast.success('Requested vehicle added');
    },
    onError: (error) => {
      toast.error(`Failed to add requested vehicle: ${error.message}`);
    },
  });
}

// Update requested vehicle
export function useUpdateRequestedVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BookingRequestedVehicle> & { id: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: requestedVehicle, error } = await supabase
        .from('booking_requested_vehicles')
        .update({
          ...data,
          updated_by: userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return requestedVehicle as BookingRequestedVehicle;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['booking-requested-vehicles', data.booking_id] });
      queryClient.invalidateQueries({ queryKey: ['booking', data.booking_id] });
      toast.success('Requested vehicle updated');
    },
    onError: (error) => {
      toast.error(`Failed to update requested vehicle: ${error.message}`);
    },
  });
}

// Delete requested vehicle
export function useDeleteRequestedVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get booking_id before deleting
      const { data: requestedVehicle } = await supabase
        .from('booking_requested_vehicles')
        .select('booking_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('booking_requested_vehicles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return requestedVehicle?.booking_id;
    },
    onSuccess: (bookingId) => {
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ['booking-requested-vehicles', bookingId] });
        queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      }
      toast.success('Requested vehicle removed');
    },
    onError: (error) => {
      toast.error(`Failed to remove requested vehicle: ${error.message}`);
    },
  });
}
