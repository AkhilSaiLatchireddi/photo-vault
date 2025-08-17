import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { User, Settings, Save, Camera, MapPin, Globe, Phone, Briefcase, Heart, Calendar, Users, Twitter, Instagram, Linkedin, Github, Bell } from 'lucide-react';

// Debug logging setup
const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const debugLog = (message: string, data?: any) => {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[USERPROFILE-DEBUG] ${timestamp}: ${message}`, data || '');
  }
};

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  name?: string;
  picture?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    bio?: string;
    location?: string;
    website?: string;
    phone?: string;
    occupation?: string;
    preferences?: {
      theme?: 'light' | 'dark' | 'auto';
      privacy?: 'public' | 'private' | 'friends';
    };
  };
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function UserProfileComponent() {
  debugLog('UserProfileComponent initialized');
  
  const { getAccessTokenSilently } = useAuth0();
  debugLog('Auth0 hooks retrieved', { hasGetAccessTokenSilently: !!getAccessTokenSilently });
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
  
  // Form data with default values
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'friends'>('public');
  
  // Social Links
  const [twitter, setTwitter] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  
  // Notification Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [uploadNotifications, setUploadNotifications] = useState(true);
  const [sharingNotifications, setSharingNotifications] = useState(true);

  // Get Auth0 token
  const getToken = async () => {
    debugLog('getToken called');
    try {
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
      debugLog('Requesting access token silently', { hasAudience: !!audience, audience });
      return await getAccessTokenSilently({
        authorizationParams: {
          ...(audience ? { audience } : {})
        }
      });
    } catch (error) {
      debugLog('Error getting token', { error: error instanceof Error ? error.message : String(error) });
      console.error('Error getting token:', error);
      return null;
    }
  };

  // Fetch user profile
  const fetchProfile = async () => {
    debugLog('fetchProfile called');
    setLoading(true);
    setError(null);
    try {
      debugLog('Requesting auth token for profile fetch');
      const token = await getToken();
      if (!token) {
        debugLog('No token received, throwing error');
        throw new Error('Unable to get authentication token');
      }
      
      debugLog('Making profile API request', { apiBaseUrl: API_BASE_URL });
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      debugLog('Profile API response received', { 
        status: response.status,
        ok: response.ok 
      });

      const data = await response.json();
      debugLog('Profile data parsed', { 
        success: data.success,
        hasData: !!data.data 
      });
      
      if (data.success) {
        const userProfile = data.data;
        setProfile(userProfile);
        debugLog('Profile state updated', { userId: userProfile._id, email: userProfile.email });
        
        // Update form fields with existing data
        setFirstName(userProfile.profile?.firstName || '');
        setLastName(userProfile.profile?.lastName || '');
        setDisplayName(userProfile.profile?.displayName || '');
        setBio(userProfile.profile?.bio || '');
        setLocation(userProfile.profile?.location || '');
        setWebsite(userProfile.profile?.website || '');
        setPhone(userProfile.profile?.phone || '');
        setOccupation(userProfile.profile?.occupation || '');
        setBirthDate(userProfile.profile?.birthDate || '');
        setInterests(userProfile.profile?.interests || []);
        setTheme(userProfile.profile?.preferences?.theme || 'auto');
        setPrivacy(userProfile.profile?.preferences?.privacy || 'public');
        
        debugLog('Form fields populated from profile data');
        
        // Social Links
        setTwitter(userProfile.profile?.socialLinks?.twitter || '');
        setInstagram(userProfile.profile?.socialLinks?.instagram || '');
        setLinkedin(userProfile.profile?.socialLinks?.linkedin || '');
        setGithub(userProfile.profile?.socialLinks?.github || '');
        
        // Notification Preferences
        setEmailNotifications(userProfile.profile?.preferences?.notifications?.email ?? true);
        setUploadNotifications(userProfile.profile?.preferences?.notifications?.uploads ?? true);
        setSharingNotifications(userProfile.profile?.preferences?.notifications?.sharing ?? true);
      } else {
        console.error('❌ API returned error:', data.error);
        setError(data.error || 'Failed to fetch profile');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get authentication token');
      }
      
      const profileData = {
        firstName,
        lastName,
        displayName,
        bio,
        location,
        website,
        phone,
        occupation,
        birthDate,
        interests,
        socialLinks: {
          twitter,
          instagram,
          linkedin,
          github
        },
        preferences: {
          theme,
          privacy,
          notifications: {
            email: emailNotifications,
            uploads: uploadNotifications,
            sharing: sharingNotifications
          }
        }
      };
      
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile: profileData }),
      });

      const data = await response.json();
      
      if (data.success) {
        setProfile(data.data);
        alert('Profile updated successfully!');
      } else {
        console.error('❌ Profile update failed:', data);
        if (data.details) {
          console.error('📋 Validation details:', data.details);
          const validationMessages = data.details.map((detail: any) => `${detail.path}: ${detail.msg}`).join(', ');
          setError(`Validation failed: ${validationMessages}`);
        } else {
          setError(data.error || 'Failed to update profile');
        }
      }
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Failed to load profile</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative">
              {profile.picture ? (
                <img 
                  src={profile.picture} 
                  alt="Profile" 
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
              )}
              <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="ml-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {displayName || profile.name || profile.username}
              </h1>
              <p className="text-gray-600">{profile.email}</p>
              <p className="text-sm text-gray-500">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={updateProfile}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'profile'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="h-4 w-4 mr-2 inline" />
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'preferences'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="h-4 w-4 mr-2 inline" />
              Preferences
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your last name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="How would you like to be displayed?"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Heart className="h-4 w-4 inline mr-1" />
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Tell us about yourself..."
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {bio.length}/500 characters
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Birth Date
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="h-4 w-4 inline mr-1" />
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City, Country"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Globe className="h-4 w-4 inline mr-1" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="h-4 w-4 inline mr-1" />
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Briefcase className="h-4 w-4 inline mr-1" />
                      Occupation
                    </label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Your job title or profession"
                    />
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  <Users className="h-5 w-5 inline mr-2" />
                  Interests
                </h3>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Add your interests (press Enter to add)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {interests.map((interest, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {interest}
                        <button
                          onClick={() => setInterests(interests.filter((_, i) => i !== index))}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Type an interest and press Enter"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        e.preventDefault();
                        const newInterest = e.currentTarget.value.trim();
                        if (!interests.includes(newInterest)) {
                          setInterests([...interests, newInterest]);
                        }
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Twitter className="h-4 w-4 inline mr-1" />
                      Twitter
                    </label>
                    <input
                      type="text"
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="@yourusername"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Instagram className="h-4 w-4 inline mr-1" />
                      Instagram
                    </label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="@yourusername"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Linkedin className="h-4 w-4 inline mr-1" />
                      LinkedIn
                    </label>
                    <input
                      type="text"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="linkedin.com/in/yourusername"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Github className="h-4 w-4 inline mr-1" />
                      GitHub
                    </label>
                    <input
                      type="text"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="github.com/yourusername"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Theme Preferences */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme</h3>
                <div className="flex space-x-4">
                  {['light', 'dark', 'auto'].map((themeOption) => (
                    <label key={themeOption} className="flex items-center">
                      <input
                        type="radio"
                        name="theme"
                        value={themeOption}
                        checked={theme === themeOption}
                        onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                        className="mr-2"
                      />
                      <span className="capitalize">{themeOption}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Privacy Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy</h3>
                <div className="flex space-x-4">
                  {(['public', 'private', 'friends'] as const).map((privacyOption) => (
                    <label key={privacyOption} className="flex items-center">
                      <input
                        type="radio"
                        name="privacy"
                        value={privacyOption}
                        checked={privacy === privacyOption}
                        onChange={(e) => setPrivacy(e.target.value as 'public' | 'private' | 'friends')}
                        className="mr-2"
                      />
                      <span className="capitalize">{privacyOption}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notification Preferences */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  <Bell className="h-5 w-5 inline mr-2" />
                  Notifications
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span>Email notifications</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={uploadNotifications}
                      onChange={(e) => setUploadNotifications(e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span>Upload notifications</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={sharingNotifications}
                      onChange={(e) => setSharingNotifications(e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span>Sharing notifications</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
