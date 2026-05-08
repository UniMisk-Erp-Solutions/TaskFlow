import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { formatDateDMY } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Car, CalendarDays } from 'lucide-react';
import { useBookingsForCalendar, useAvailableCars } from '@/hooks/use-bookings';
import { useCars } from '@/hooks/use-cars';
import { useAuth } from '@/lib/auth-context';
import { useDowntimeLogs } from '@/hooks/use-downtime';
import { BookingStatusBadge } from '@/components/bookings/BookingStatusBadge';
import { BookingDetailsDrawer } from '@/components/bookings/BookingDetailsDrawer';
import { AvailabilityPopover } from '@/components/bookings/AvailabilityPopover';
import { cn, formatCarLabel } from '@/lib/utils';
import { BOOKING_STATUS_COLORS, type BookingWithDetails, type BookingStatus } from '@/types/booking';
import type { Car } from '@/types';

type ViewType = 'month' | 'week' | 'day';
type CalendarViewMode = 'bookings' | 'availability';

// Availability monitor: by-date (available cars) and by-car (free dates)
function AvailabilityMonitor({
  currentDate,
  availabilityDateStart,
  setAvailabilityDateStart,
  availabilityDateEnd,
  setAvailabilityDateEnd,
  availabilityCarId,
  setAvailabilityCarId,
  brandFilter,
  setBrandFilter,
  bookableCars,
  brands,
  dateRange,
  bookings,
  navigate,
}: {
  currentDate: Date;
  availabilityDateStart: Date;
  setAvailabilityDateStart: (d: Date) => void;
  availabilityDateEnd: Date;
  setAvailabilityDateEnd: (d: Date) => void;
  availabilityCarId: string;
  setAvailabilityCarId: (id: string) => void;
  brandFilter: string;
  setBrandFilter: (b: string) => void;
  bookableCars: Car[];
  brands: string[];
  dateRange: { start: Date; end: Date };
  bookings: BookingWithDetails[];
  navigate: (to: string) => void;
}) {
  const rangeStart = startOfDay(availabilityDateStart);
  let rangeEnd = endOfDay(availabilityDateEnd);
  if (rangeEnd < rangeStart) rangeEnd = rangeStart;
  const { data: availableForDay, isLoading: loadingAvailable } = useAvailableCars(rangeStart, rangeEnd);
  const { data: downtimeLogs } = useDowntimeLogs(availabilityCarId || undefined);

  const carIdToCar = useMemo(
    () => Object.fromEntries(bookableCars.map(c => [c.id, c])),
    [bookableCars]
  );

  const availableCarsFiltered = useMemo(() => {
    const list = availableForDay?.filter(c => c.is_available) ?? [];
    if (brandFilter === 'all') return list;
    return list.filter(a => carIdToCar[a.car_id]?.brand === brandFilter);
  }, [availableForDay, brandFilter, carIdToCar]);

  const carsForCarDropdown = useMemo(
    () =>
      brandFilter === 'all'
        ? bookableCars
        : bookableCars.filter(c => c.brand === brandFilter),
    [bookableCars, brandFilter]
  );

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }),
    [currentDate]
  );

  const freeDatesForCar = useMemo(() => {
    if (!availabilityCarId) return [];
    const bookedRanges = bookings
      .filter(b => b.booking_vehicles?.some((v: { car_id: string }) => v.car_id === availabilityCarId))
      .map(b => ({ start: new Date(b.start_at), end: new Date(b.end_at) }));
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const downtimeRanges = (downtimeLogs ?? []).map(d => ({
      start: new Date(d.started_at),
      end: d.ended_at ? new Date(d.ended_at) : new Date(monthEnd.getTime() + 86400000),
    }));

    return monthDays.filter(day => {
      const dayStartD = startOfDay(day);
      const dayEndD = endOfDay(day);
      const inBooking = bookedRanges.some(
        r => dayStartD < r.end && dayEndD > r.start
      );
      const inDowntime = downtimeRanges.some(
        r => dayStartD < r.end && dayEndD > r.start
      );
      return !inBooking && !inDowntime;
    });
  }, [availabilityCarId, bookings, currentDate, downtimeLogs, monthDays]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" />
            Available cars for a date range
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a start and end date (and optional brand) to see which cars are available for the whole period.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
              <input
                type="date"
                value={format(availabilityDateStart, 'yyyy-MM-dd')}
                onChange={e => setAvailabilityDateStart(new Date(e.target.value))}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
              <input
                type="date"
                value={format(availabilityDateEnd, 'yyyy-MM-dd')}
                onChange={e => setAvailabilityDateEnd(new Date(e.target.value))}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map(b => (
                  <SelectItem key={b} value={b!}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadingAvailable ? (
            <p className="text-sm text-muted-foreground">Checking availability…</p>
          ) : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {availableCarsFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No cars available for {format(availabilityDateStart, 'd MMM yyyy')}
                  {availabilityDateStart.getTime() !== availabilityDateEnd.getTime() && ` – ${format(availabilityDateEnd, 'd MMM yyyy')}`}.
                </p>
              ) : (
                availableCarsFiltered.map(a => {
                  const car = carIdToCar[a.car_id];
                  const startParam = format(availabilityDateStart, 'yyyy-MM-dd');
                  const endParam = format(availabilityDateEnd, 'yyyy-MM-dd');
                  const newBookingUrl = `/app/bookings/new?start=${startParam}&end=${endParam}&carId=${a.car_id}`;
                  return (
                    <button
                      key={a.car_id}
                      type="button"
                      onClick={() => navigate(newBookingUrl)}
                      className="w-full flex items-center justify-between rounded-lg border p-2 text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium">{car ? formatCarLabel({ vehicle_number: a.vehicle_number, model: a.model ?? car.model, brand: car.brand }) : a.vehicle_number}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/app/bookings/new?date=${format(availabilityDateStart, 'yyyy-MM-dd')}`)}
          >
            New booking from {format(availabilityDateStart, 'd MMM')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Free dates for a car
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a brand and car to see which dates in this month it is free.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={brandFilter} onValueChange={v => { setBrandFilter(v); setAvailabilityCarId(''); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map(b => (
                  <SelectItem key={b} value={b!}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={availabilityCarId || 'none'}
              onValueChange={v => setAvailabilityCarId(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select car" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select car</SelectItem>
                {carsForCarDropdown.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatCarLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!availabilityCarId ? (
            <p className="text-sm text-muted-foreground">Select a car to see its free dates.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {format(currentDate, 'MMMM yyyy')}: {freeDatesForCar.length} free days
              </p>
              <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                {freeDatesForCar.map(day => {
                  const d = format(day, 'yyyy-MM-dd');
                  const url = availabilityCarId
                    ? `/app/bookings/new?start=${d}&end=${d}&carId=${availabilityCarId}`
                    : `/app/bookings/new?date=${d}`;
                  return (
                    <Button
                      key={day.toISOString()}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => navigate(url)}
                    >
                      {format(day, 'd MMM')}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookingCalendar() {
  const navigate = useNavigate();
  const { isSupervisor, isAdmin, isManager } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [viewMode, setViewMode] = useState<CalendarViewMode>('bookings');
  const [selectedCar, setSelectedCar] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<{ start: Date; end: Date } | null>(null);
  // Availability: by-date
  const [availabilityDateStart, setAvailabilityDateStart] = useState(() => new Date());
  const [availabilityDateEnd, setAvailabilityDateEnd] = useState(() => new Date());
  // Availability: by-car
  const [availabilityCarId, setAvailabilityCarId] = useState<string>('');

  const { data: cars } = useCars();

  // Calculate date range for query
  const dateRange = useMemo(() => {
    let start: Date, end: Date;
    if (view === 'month') {
      start = startOfWeek(startOfMonth(currentDate));
      end = endOfWeek(endOfMonth(currentDate));
    } else if (view === 'week') {
      start = startOfWeek(currentDate);
      end = endOfWeek(currentDate);
    } else {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    }
    return { start, end };
  }, [currentDate, view]);

  const { data: bookings, isLoading } = useBookingsForCalendar(dateRange.start, dateRange.end);

  // Cars that can be assigned (exclude permanently assigned) for availability
  const bookableCars = useMemo(
    () => (cars ?? []).filter(c => !c.on_permanent_assignment),
    [cars]
  );

  const carIdToBrand = useMemo(
    () => Object.fromEntries((cars ?? []).map(c => [c.id, c.brand]).filter(([, b]) => b != null)),
    [cars]
  );

  const brands = useMemo(
    () => [...new Set((cars ?? []).map(c => c.brand).filter(Boolean))].sort() as string[],
    [cars]
  );

  // Filter bookings (by car, brand, status)
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter(b => {
      if (selectedCar !== 'all') {
        const hasCar = b.booking_vehicles?.some((v: { car_id: string }) => v.car_id === selectedCar);
        if (!hasCar) return false;
      }
      if (brandFilter !== 'all') {
        const hasBrand = b.booking_vehicles?.some(
          (v: { car_id: string }) => carIdToBrand[v.car_id] === brandFilter
        );
        if (!hasBrand) return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return true;
    });
  }, [bookings, selectedCar, brandFilter, statusFilter, carIdToBrand]);

  // Navigation
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      if (view === 'month') return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      if (view === 'week') return direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
      return direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1);
    });
  }, [view]);

  // Get days for calendar grid
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Get bookings for a specific day
  const getBookingsForDay = useCallback((day: Date) => {
    return filteredBookings.filter(b => {
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      return day >= startOfDay(start) && day <= endOfDay(end);
    });
  }, [filteredBookings]);

  const handleBookingClick = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setDrawerOpen(true);
  };

  const handleSlotHover = (day: Date) => {
    setHoveredSlot({ start: startOfDay(day), end: endOfDay(day) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Booking Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visual view of all bookings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/bookings')}>
            List View
          </Button>
          {!(isSupervisor && !isAdmin && !isManager) && (
            <Button onClick={() => navigate('/app/bookings/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold ml-2">
                {viewMode === 'availability' && format(currentDate, 'MMMM yyyy')}
                {viewMode === 'bookings' && view === 'month' && format(currentDate, 'MMMM yyyy')}
                {viewMode === 'bookings' && view === 'week' && `${formatDateDMY(startOfWeek(currentDate))} - ${formatDateDMY(endOfWeek(currentDate))}`}
                {viewMode === 'bookings' && view === 'day' && `${format(currentDate, 'EEEE')}, ${formatDateDMY(currentDate)}`}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as CalendarViewMode)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bookings">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Bookings
                    </span>
                  </SelectItem>
                  <SelectItem value="availability">
                    <span className="flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      Availability
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {viewMode === 'bookings' && (
                <>
                  <Select value={view} onValueChange={(v) => setView(v as ViewType)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map(b => (
                        <SelectItem key={b} value={b!}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedCar} onValueChange={setSelectedCar}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Cars" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cars</SelectItem>
                      {cars?.map(car => (
                        <SelectItem key={car.id} value={car.id}>
                          {formatCarLabel(car)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="inquiry">Inquiry</SelectItem>
                      <SelectItem value="tentative">Tentative</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'bookings' ? (
        <>
          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-0">
              {/* Week day headers */}
              <div className="grid grid-cols-7 border-b">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayBookings = getBookingsForDay(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = isSameDay(day, new Date());

                  return (
                    <Popover key={idx}>
                      <PopoverTrigger asChild>
                        <div
                          className={cn(
                            'min-h-[100px] p-1 border-r border-b cursor-pointer hover:bg-muted/30 transition-colors',
                            !isCurrentMonth && 'bg-muted/10',
                            isToday && 'bg-primary/5'
                          )}
                          onMouseEnter={() => handleSlotHover(day)}
                          onMouseLeave={() => setHoveredSlot(null)}
                        >
                          <div className={cn(
                            'text-sm font-medium p-1',
                            !isCurrentMonth && 'text-muted-foreground',
                            isToday && 'text-primary'
                          )}>
                            {format(day, 'd')}
                          </div>
                          <div className="space-y-0.5 max-h-[80px] overflow-hidden">
                            {dayBookings.slice(0, 3).map(booking => {
                              const assignedLabels = booking.booking_vehicles
                                ?.map(bv => {
                                  const car = bv.car ?? (bv as { cars?: { vehicle_number: string; model?: string | null; brand?: string | null } }).cars;
                                  return car ? formatCarLabel(car) : null;
                                })
                                .filter(Boolean) as string[] | undefined;
                              const requestedLabels = booking.booking_requested_vehicles
                                ?.map(rv => [rv.brand, rv.model].filter(Boolean).join(' ').trim() || null)
                                .filter(Boolean) as string[] | undefined;
                              const vehicleText = (assignedLabels?.length ? assignedLabels : requestedLabels?.length ? requestedLabels : null)
                                ?.join(', ') ?? null;
                              const displayLabel = vehicleText ? (assignedLabels?.length ? vehicleText : `Requested: ${vehicleText}`) : null;
                              return (
                                <div
                                  key={booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBookingClick(booking);
                                  }}
                                  className={cn(
                                    'text-xs p-1 rounded truncate cursor-pointer',
                                    BOOKING_STATUS_COLORS[booking.status].bg,
                                    BOOKING_STATUS_COLORS[booking.status].text
                                  )}
                                  title={displayLabel ? `${booking.customer_name} — ${displayLabel}` : booking.customer_name}
                                >
                                  {displayLabel
                                    ? `${booking.customer_name} · ${displayLabel}`
                                    : booking.customer_name}
                                </div>
                              );
                            })}
                            {dayBookings.length > 3 && (
                              <div className="text-xs text-muted-foreground px-1">
                                +{dayBookings.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-auto" align="start">
                        <AvailabilityPopover
                          startAt={startOfDay(day)}
                          endAt={endOfDay(day)}
                          onCheckAvailability={() => navigate(`/app/bookings/new?date=${format(day, 'yyyy-MM-dd')}`)}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Status Legend */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {(['inquiry', 'tentative', 'confirmed', 'ongoing', 'completed', 'cancelled'] as BookingStatus[]).map(status => (
                  <div key={status} className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded', BOOKING_STATUS_COLORS[status].bg)} />
                    <BookingStatusBadge status={status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <AvailabilityMonitor
          currentDate={currentDate}
          availabilityDateStart={availabilityDateStart}
          setAvailabilityDateStart={setAvailabilityDateStart}
          availabilityDateEnd={availabilityDateEnd}
          setAvailabilityDateEnd={setAvailabilityDateEnd}
          availabilityCarId={availabilityCarId}
          setAvailabilityCarId={setAvailabilityCarId}
          brandFilter={brandFilter}
          setBrandFilter={setBrandFilter}
          bookableCars={bookableCars}
          brands={brands}
          dateRange={dateRange}
          bookings={bookings ?? []}
          navigate={navigate}
        />
      )}

      {/* Booking Details Drawer */}
      <BookingDetailsDrawer
        booking={selectedBooking}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={() => {
          setDrawerOpen(false);
          if (selectedBooking) navigate(`/app/bookings/${selectedBooking.id}/edit`);
        }}
        onViewInvoice={() => {
          if (selectedBooking) navigate(`/app/bookings/${selectedBooking.id}/bills`);
        }}
      />
    </div>
  );
}
