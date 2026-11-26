import { m } from '@/paraglide/messages.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DirectorySortValue = 'recommended' | 'popular' | 'name' | 'latest';

export function DirectorySortSelect({
  value,
  onChange,
}: {
  value: DirectorySortValue | string;
  onChange: (value: DirectorySortValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        onChange(next as DirectorySortValue);
      }}
    >
      <SelectTrigger
        className="h-8 min-w-36"
        size="sm"
        aria-label={m['directory.sort_by']()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="recommended">
          {m['directory.sort.recommended']()}
        </SelectItem>
        <SelectItem value="popular">{m['directory.sort.popular']()}</SelectItem>
        <SelectItem value="latest">{m['directory.sort.latest']()}</SelectItem>
        <SelectItem value="name">{m['directory.sort.name']()}</SelectItem>
      </SelectContent>
    </Select>
  );
}
