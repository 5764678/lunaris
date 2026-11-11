import { MissionPanel } from "@/components/mission/mission-panel";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { MoonViewport } from "@/components/viewport/moon-viewport";

export default function MissionOverviewPage() {
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:grid-rows-[minmax(24rem,1fr)_auto] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="h-[62vh] min-h-0 lg:h-auto">
        <MoonViewport />
      </div>
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <MissionPanel />
      </div>
      <div className="lg:col-start-1 lg:row-start-2">
        <TimelinePanel />
      </div>
    </div>
  );
}
