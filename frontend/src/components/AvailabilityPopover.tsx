import { useAvailableCars } from '@/hooks/use-bookings';
import { Car, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCarLabel } from '@/lib/utils';

interface AvailabilityPopoverProps {
  startAt: Date;
  endAt: Date;
  onCheckAvailability?: () => void;
}

export function AvailabilityPopover({ startAt, endAt, onCheckAvailability }: AvailabilityPopoverProps) {
  const { data: cars, isLoading } = useAvailableCars(startAt, endAt);
  
  const availableCars = cars?.filter(c => c.is_available) || [];
  const displayCars = availableCars.slice(0, 5);

  if (isLoading) {
    return (
      <div className="p-3 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking...</span>
      </div>
    );
  }

  return (
    <div className="p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <Car className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Available: {availableCars.length} cars
        </span>
      </div>
      
      {displayCars.length > 0 ? (
        <div className="space-y-1 max-h-[150px] overflow-y-auto">
          {displayCars.map((car) => (
            <div key={car.car_id} className="flex items-center gap-2 text-sm">
              <Check className="h-3 w-3 text-success" />
              <span>{formatCarLabel({ vehicle_number: car.vehicle_number, model: car.model })}</span>
            </div>
          ))}
          {availableCars.length > 5 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{availableCars.length - 5} more
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <X className="h-3 w-3 text-destructive" />
          <span>No cars available</span>
        </div>
      )}

      {onCheckAvailability && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={onCheckAvailability}
        >
          Check Availability
        </Button>
      )}
    </div>
  );
}
