// Location: frontend/src/features/settings/pages/SettingsPage.tsx
// ACTION: CREATE NEW FILE

import FacebookConnectButton from '../../facebook/components/FacebookConnectButton';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ Settings</h1>
        <p className="text-gray-600">Manage your account and integrations</p>
      </div>
      
      <div className="space-y-8">
        <FacebookConnectButton />
      </div>
    </div>
  );
}