import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { facebookApi, type FacebookPageInfo } from '../api/facebookApi';

export default function FacebookConnectButton() {
  const [pageInfo, setPageInfo] = useState<FacebookPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const processingRef = useRef(false); // 💡 Stops double execution loops in Strict Mode

  useEffect(() => {
    const code = searchParams.get('code');
    
    if (code && !processingRef.current) {
      processingRef.current = true;
      handleOAuthCallback(code);
    } else if (!code) {
      loadPageInfo();
    }
  }, [searchParams]);

  const loadPageInfo = async () => {
    try {
      setLoading(true);
      const info = await facebookApi.getPageInfo();
      setPageInfo(info);
    } catch (err: any) {
      console.error('❌ Error loading page info:', err);
      setError('Failed to load page info');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const { authUrl } = await facebookApi.getAuthUrl();
      window.location.href = authUrl; // Directs user out to Meta validation flow
    } catch (err: any) {
      console.error('❌ Error initiating connection:', err);
      setError('Failed to initiate Facebook connection');
    }
  };

  const handleOAuthCallback = async (code: string) => {
    try {
      setLoading(true);
      await facebookApi.handleCallback(code);
      
      // Clean query parameters from URL without breaking view routers
      searchParams.delete('code');
      searchParams.delete('state');
      setSearchParams(searchParams, { replace: true });
      
      await loadPageInfo();
    } catch (err: any) {
      console.error('❌ OAuth callback error:', err);
      setError('Failed to connect Facebook page: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (confirm('Are you sure you want to disconnect this Facebook page?')) {
        await facebookApi.disconnect();
        setPageInfo({ connected: false });
        setError('');
      }
    } catch (err: any) {
      console.error('❌ Error disconnecting:', err);
      setError('Failed to disconnect Facebook page');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center min-h-[140px]">
        <div className="text-gray-500 flex items-center gap-2">
          <span className="animate-spin text-lg">⏳</span> Syncing page authentication profile...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          📘 Facebook Page Connection
        </h3>
        <p className="text-sm text-gray-600">
          Connect your organization's Facebook page to schedule and publish posts.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      {pageInfo?.connected ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-4">
            {pageInfo.pageAvatar && (
              <img
                src={pageInfo.pageAvatar}
                alt={pageInfo.pageName}
                className="w-16 h-16 rounded-full border-2 border-green-300 object-cover"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">✅ Connected Page</p>
              <p className="text-lg font-semibold text-green-700">{pageInfo.pageName}</p>
              <p className="text-xs text-gray-500">ID: {pageInfo.pageId}</p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition whitespace-nowrap"
            >
              🔗 Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-4">
            No Facebook page connected yet. Click below to connect your organization's page.
          </p>
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            📘 Connect Facebook Page
          </button>
        </div>
      )}
    </div>
  );
}