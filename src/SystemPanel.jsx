import InfraHealthPanel from './InfraHealthPanel';
import BackupStatusPanel from './BackupStatusPanel';
import WeightLimitSettings from './WeightLimitSettings';

export default function SystemPanel() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">System</h2>
      <InfraHealthPanel />
      <BackupStatusPanel />
      <WeightLimitSettings />
    </div>
  );
}
