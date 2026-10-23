// Composition root: one feed provider, one Drift view.

import { StationFeedProvider } from '@/hooks/useStationFeed';
import { DriftView } from '@/components/drift/DriftView';

export default function App() {
  return (
    <StationFeedProvider>
      <DriftView />
    </StationFeedProvider>
  );
}
