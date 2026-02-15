import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/profile.css';

function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [translations, setTranslations] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editForm, setEditForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    // Initialize form when user data is set
    useEffect(() => {
        if (user) {
            setEditForm(prev => ({
                ...prev,
                username: user.username || '',
                email: user.email || ''
            }));
        }
    }, [user]);

    // Sidebar/tab state and history filter
    const [selectedTab, setSelectedTab] = useState('profile'); // 'profile' | 'history'
    const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'audio' | 'video'

    useEffect(() => {
        if (!authService.isAuthenticated()) {
            navigate('/login');
            return;
        }

        loadUserData();
    }, [navigate]);

    const loadUserData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!authService.isAuthenticated()) {
                console.log('No authentication, redirecting to login');
                navigate('/login');
                return;
            }

            try {
                // Load user profile and translations in parallel using authApi
                const [profileRes, translationsRes] = await Promise.all([
                    authService.getUserProfile(),
                    authService.getUserTranslations()
                ]);

                if (profileRes && typeof profileRes === 'object') {
                    setUser(profileRes);
                    setTranslations(Array.isArray(translationsRes) ? translationsRes : []);
                } else {
                    throw new Error('Invalid profile data received');
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                if (apiError.response?.status === 401) {
                    authService.logout();
                    navigate('/login');
                    return;
                }
                throw apiError;
            }
        } catch (err) {
            console.error('Error loading user data:', err);
            setError(err.message || 'Failed to load user data');
            if (!authService.isAuthenticated()) {
                navigate('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (editForm.password !== editForm.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const updates = {
                username: editForm.username,
                email: editForm.email
            };

            if (editForm.password) {
                updates.password = editForm.password;
            }

            const updatedUser = await authService.updateProfile(updates);
            setUser(updatedUser);
            setIsEditing(false);
            setEditForm(prev => ({
                ...prev,
                password: '',
                confirmPassword: ''
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    // Helpers for media type detection + URL
    const getFileExtension = (filename) => {
        if (!filename || typeof filename !== 'string') return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    };

    const isVideoFile = (filename) => {
        const ext = getFileExtension(filename);
        return ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext);
    };

    const isAudioFile = (filename) => {
        const ext = getFileExtension(filename);
        return ['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext);
    };

    const getFileUrl = (filename) => {
        if (!filename) return '#';
        // If filename already looks like a full URL, return it
        if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
        return `http://localhost:5001/uploads/${filename}`;
    };

    const getBaseName = (path) => {
        if (!path) return '';
        try {
            // If it's a URL, strip query/hash
            const url = new URL(path);
            const pathname = url.pathname;
            return pathname.substring(pathname.lastIndexOf('/') + 1);
        } catch (e) {
            // Not a full URL, treat as filename or path
            const parts = path.split('/');
            return parts[parts.length - 1];
        }
    };

    if (!authService.isAuthenticated()) {
        return null; // Will redirect in useEffect
    }

    if (isLoading) {
        return <div className="profile-loading">Loading...</div>;
    }

    if (error) {
        return (
            <div className="profile-error">
                <p>{error}</p>
                <button
                    onClick={() => loadUserData()}
                    className="retry-button"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!user) {
        return <div className="profile-error">No user data available</div>;
    }

    const filteredTranslations = translations.filter(t => {
        if (historyFilter === 'all') return true;
        const originalIsVideo = isVideoFile(t.originalFile) || isVideoFile(t.translatedFile);
        const originalIsAudio = isAudioFile(t.originalFile) || isAudioFile(t.translatedFile);
        if (historyFilter === 'video') return originalIsVideo;
        if (historyFilter === 'audio') return originalIsAudio;
        return true;
    });

    return (
        <div className="profile">
            <div className="profile-container">
                <div className="profile-header">
                    <h1>User Profile</h1>
                </div>

                {error && <div className="profile-alert error">{error}</div>}

                <div className="profile-content sidebar-layout">
                    <aside className="profile-sidebar">
                        <nav>
                            <ul>
                                <li className={selectedTab === 'profile' ? 'active' : ''}>
                                    <button onClick={() => setSelectedTab('profile')}>Profile</button>
                                </li>
                                <li className={selectedTab === 'history' ? 'active' : ''}>
                                    <button onClick={() => setSelectedTab('history')}>History</button>
                                </li>
                            </ul>
                        </nav>
                    </aside>

                    <main className="profile-main">
                        {selectedTab === 'profile' ? (
                            <div className="profile-section user-details">
                                <div className="profile-card">
                                    <div className="profile-card-left">
                                        <div className="avatar">{getInitials(user.username)}</div>
                                        <div className="profile-summary">
                                            <h2 className="profile-name">{user.username}</h2>
                                            <div className="profile-email">{user.email}</div>
                                            <div className="profile-member">Member since {new Date(user.createdAt).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="profile-card-right">
                                        <div className="profile-stats">
                                            <div className="stat">
                                                <div className="stat-value">{translations.length}</div>
                                                <div className="stat-label">Translations</div>
                                            </div>
                                            <div className="stat">
                                                <div className="stat-value">{translations.filter(t=>isAudioFile(t.originalFile)||isAudioFile(t.translatedFile)).length}</div>
                                                <div className="stat-label">Audio</div>
                                            </div>
                                            <div className="stat">
                                                <div className="stat-value">{translations.filter(t=>isVideoFile(t.originalFile)||isVideoFile(t.translatedFile)).length}</div>
                                                <div className="stat-label">Video</div>
                                            </div>
                                        </div>
                                        <div className="profile-actions">
                                            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Edit Profile</button>
                                            <button className="btn btn-secondary" onClick={() => authService.logout() && navigate('/')}>Logout</button>
                                        </div>
                                    </div>
                                </div>

                                {isEditing ? (
                                    <form onSubmit={handleEditSubmit} className="edit-form card-form">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Username</label>
                                                <input
                                                    type="text"
                                                    value={editForm.username}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Email</label>
                                                <input
                                                    type="email"
                                                    value={editForm.email}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>New Password (leave blank to keep current)</label>
                                                <input
                                                    type="password"
                                                    value={editForm.password}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Confirm New Password</label>
                                                <input
                                                    type="password"
                                                    value={editForm.confirmPassword}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-buttons">
                                            <button type="submit" disabled={isLoading} className="btn btn-primary">
                                                {isLoading ? 'Saving...' : 'Save Changes'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setError(null);
                                                    setEditForm({
                                                        username: user.username,
                                                        email: user.email,
                                                        password: '',
                                                        confirmPassword: ''
                                                    });
                                                }}
                                                disabled={isLoading}
                                                className="btn btn-secondary"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="user-info professional">
                                        <p><strong>Username:</strong> {user.username}</p>
                                        <p><strong>Email:</strong> {user.email}</p>
                                        <p><strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="profile-section translation-history">
                                <h2>Translation History</h2>

                                <div className="history-controls">
                                    <div className="filter-buttons">
                                        <button className={historyFilter === 'all' ? 'active' : ''} onClick={() => setHistoryFilter('all')}>All</button>
                                        <button className={historyFilter === 'audio' ? 'active' : ''} onClick={() => setHistoryFilter('audio')}>Audio</button>
                                        <button className={historyFilter === 'video' ? 'active' : ''} onClick={() => setHistoryFilter('video')}>Video</button>
                                    </div>
                                </div>

                                {filteredTranslations.length === 0 ? (
                                    <p className="no-translations">No translations match your filter</p>
                                ) : (
                                    <div className="translations-list">
                                        {filteredTranslations.map(translation => (
                                            <div key={translation._id} className="translation-item media-item">
                                                <div className="translation-media">
                                                    <div className="media-block">
                                                        <p className="media-label">Original</p>
                                                        {isVideoFile(translation.originalFile) ? (
                                                            <video controls src={getFileUrl(translation.originalFile)} className="media-player" />
                                                        ) : isAudioFile(translation.originalFile) ? (
                                                            <audio controls src={getFileUrl(translation.originalFile)} className="media-player" />
                                                        ) : (
                                                            <p className="media-missing">Original file not available</p>
                                                        )}
                                                        {translation.originalFile && (
                                                            <a href={getFileUrl(translation.originalFile)} className="download-button" target="_blank" rel="noopener noreferrer">Download Original</a>
                                                        )}
                                                    </div>

                                                    <div className="media-block">
                                                        <p className="media-label">Translated</p>
                                                        {isVideoFile(translation.translatedFile) ? (
                                                            <video controls src={getFileUrl(translation.translatedFile)} className="media-player" />
                                                        ) : isAudioFile(translation.translatedFile) ? (
                                                            <audio controls src={getFileUrl(translation.translatedFile)} className="media-player" />
                                                        ) : (
                                                            <p className="media-missing">Translated file not available</p>
                                                        )}
                                                        {translation.translatedFile && (
                                                            <a href={getFileUrl(translation.translatedFile)} className="download-button" target="_blank" rel="noopener noreferrer">Download Translated</a>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="translation-info">
                                                    <p className="file-name">{getBaseName(translation.originalFile)}</p>
                                                    <p><strong>Languages:</strong> {translation.originalLanguage || 'Auto'} → {translation.targetLanguage}</p>
                                                    <p><strong>Date:</strong> {new Date(translation.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

export default Profile;