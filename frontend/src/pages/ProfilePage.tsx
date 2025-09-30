import UserProfileClean from '../components/UserProfileClean';
import Layout from '../components/layout/Layout';

export default function ProfilePage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">User Profile</h2>
          <p className="text-gray-600 mt-1">Manage your account settings</p>
        </div>
        
        <UserProfileClean />
      </div>
    </Layout>
  );
}
