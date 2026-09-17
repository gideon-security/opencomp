import { Spinner } from '@trycompai/design-system';

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      {/* Spinner forwards size to the underlying svg width/height, which only
          accept lengths — never a "lg" token (React logs an <svg> attribute
          error otherwise). */}
      <Spinner size={32} />
    </div>
  );
}
