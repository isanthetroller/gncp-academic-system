/**
 * Student Portal - Authenticated Dashboard Controller
 * Glues Vue 3 reactive state, StudentModel helpers, and StudentApiService calls.
 * Enforces session validation and redirects unauthenticated requests to login.html.
 */

window.StudentPortalController = {
    setup() {
        const { ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;

        // Session & Auth State
        const currentStudent = ref(null);

        // Navigation & Layout
        const activeTab = ref('dashboard');
        const showLogoutConfirm = ref(false);
        const isMobileMenuOpen = ref(false);
        const photoInput = ref(null);
        const updateSuccessMsg = ref('');

        // Data State
        const state = reactive({
            ...StudentModel.createInitialState(),
            corData: null
        });

        const studentForm = reactive({
            phone: '',
            personalEmail: '',
            address: '',
            emergencyContactName: '',
            emergencyContactPhone: ''
        });

        // Password Change Form State
        const updatingPass = ref(false);
        const passError = ref('');
        const showCurrentPass = ref(false);
        const showNewPass = ref(false);
        const passStrengthLevel = ref(0);

        const pass = ref({
            current: '',
            newPass: '',
            confirm: ''
        });

        const passStrengthLabel = computed(() => {
            switch (passStrengthLevel.value) {
                case 1: return 'Weak';
                case 2: return 'Moderate';
                case 3: return 'Strong';
                default: return '';
            }
        });

        const passStrengthColor = computed(() => {
            switch (passStrengthLevel.value) {
                case 1: return '#dc2626';
                case 2: return '#d97706';
                case 3: return '#059669';
                default: return '#e4e4e7';
            }
        });

        const passStrengthWidth = computed(() => {
            switch (passStrengthLevel.value) {
                case 1: return '33%';
                case 2: return '66%';
                case 3: return '100%';
                default: return '0%';
            }
        });

        const checkPassStrength = () => {
            const val = pass.value.newPass;
            if (!val) {
                passStrengthLevel.value = 0;
                return;
            }
            let score = 0;
            if (val.length >= 6) score++;
            if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val) && val.length >= 8) score++;
            passStrengthLevel.value = Math.max(1, score);
        };

        // Time Greeting Computed
        const timeGreeting = computed(() => {
            const hour = new Date().getHours();
            if (hour < 12) return 'Great Morning';
            if (hour < 18) return 'Great Afternoon';
            return 'Great Evening';
        });

        // Tab Title Computed
        const currentTabTitle = computed(() => {
            switch (activeTab.value) {
                case 'announcements': return 'Campus Feed & Bulletins';
                case 'dashboard': return 'Dashboard Overview & COR';
                case 'courses': return 'My Enrolled Classes (COR)';
                case 'profile': return 'My Student Profile';
                default: return 'Student Portal';
            }
        });

        // Print Form Trigger
        const printForm = () => {
            window.print();
        };

        // Computed Enrolled Units
        const totalUnits = computed(() => {
            return StudentModel.calculateTotalUnits(state.helpdesk, state.subjects);
        });

        // Computed Assigned Class Blocks
        const totalAssignedSections = computed(() => {
            return StudentModel.calculateAssignedSectionsCount(
                state.helpdesk,
                state.subjects,
                state.enrollment,
                state.profile.sectionCode
            );
        });

        // Session Check with Auto-Redirect to login.html
        const checkSession = () => {
            const stored = sessionStorage.getItem('gncp_portal_student') || localStorage.getItem('gncp_portal_student');
            if (stored) {
                try {
                    currentStudent.value = JSON.parse(stored);
                    StudentModel.hydrateProfileFromSession(state.profile, currentStudent.value);
                    syncStudentFormFromProfile();
                    fetchDashboardData();
                } catch (e) {
                    console.error('[StudentPortal::Session] Invalid stored session JSON:', e);
                    sessionStorage.removeItem('gncp_portal_student');
                    localStorage.removeItem('gncp_portal_student');
                    window.location.href = 'login.html';
                }
            } else {
                console.warn('[StudentPortal::Session] No active student session found. Redirecting to login.html...');
                window.location.href = 'login.html';
            }
        };

        const syncStudentFormFromProfile = () => {
            if (state.profile) {
                studentForm.phone = state.profile.phone || '';
                studentForm.personalEmail = state.profile.email || '';
                studentForm.address = state.profile.address || '';
                studentForm.emergencyContactName = state.profile.emergencyContactName || '';
                studentForm.emergencyContactPhone = state.profile.emergencyContactPhone || '';
            }
        };

        const isRefreshing = ref(false);

        // Fetch Complete Dashboard Data
        const fetchDashboardData = async (isBackgroundPoll = false) => {
            if (!currentStudent.value) return;
            if (!isBackgroundPoll) isRefreshing.value = true;

            const res = await StudentApiService.fetchDashboard(currentStudent.value.id);
            if (!isBackgroundPoll) isRefreshing.value = false;

            if (res.success && res.data) {
                if (res.data.profile) {
                    StudentModel.hydrateProfileFromSession(state.profile, res.data.profile);
                    syncStudentFormFromProfile();
                }
                state.roadmap = res.data.roadmap || [];
                state.requirements = res.data.requirements || null;
                state.medical = res.data.medical || null;
                state.scholarship = res.data.scholarship || null;
                state.payment = res.data.payment || null;
                state.helpdesk = res.data.helpdesk || null;
                state.enrollment = res.data.enrollment || null;
                state.subjects = res.data.subjects || [];
                state.corData = res.data.corData || null;

                if (!isBackgroundPoll) {
                    console.log('[StudentPortal::Dashboard] Data loaded successfully.', state);
                }
            }
        };

        // Photo Upload Handlers
        const triggerPhotoUpload = () => {
            if (photoInput.value) {
                photoInput.value.click();
            }
        };

        const handlePhotoSelect = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                alert('File size exceeds 2MB limits. Please select a smaller photo.');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const base64Data = evt.target.result;
                const res = await StudentApiService.uploadPhoto(currentStudent.value.id, base64Data);
                if (res.success && res.data) {
                    state.profile.photo = res.data.photo;
                    updateSuccessMsg.value = 'Profile portrait updated successfully!';
                    setTimeout(() => { updateSuccessMsg.value = ''; }, 3500);
                } else {
                    alert(res.message || 'Failed to upload photo.');
                }
            };
            reader.readAsDataURL(file);
        };

        const saving = ref(false);

        const saveStudentPersonalInfo = async () => {
            if (!currentStudent.value) return;
            saving.value = true;
            updateSuccessMsg.value = '';

            const payload = {
                phone: studentForm.phone,
                email: studentForm.personalEmail,
                address: studentForm.address,
                emergencyContactName: studentForm.emergencyContactName,
                emergencyContactPhone: studentForm.emergencyContactPhone
            };

            const res = await StudentApiService.updateProfile(currentStudent.value.id, payload);
            saving.value = false;

            if (res.success && res.data) {
                StudentModel.hydrateProfileFromSession(state.profile, res.data);
                updateSuccessMsg.value = 'Personal information updated successfully!';
                setTimeout(() => { updateSuccessMsg.value = ''; }, 3500);
            } else {
                alert(res.message || 'Failed to update profile information.');
            }
        };

        const updatePassword = async () => {
            passError.value = '';
            if (!pass.value.current || !pass.value.newPass || !pass.value.confirm) {
                passError.value = 'Please fill out all password fields.';
                return;
            }
            if (pass.value.newPass !== pass.value.confirm) {
                passError.value = 'New password and confirmation password do not match.';
                return;
            }
            if (pass.value.newPass.length < 6) {
                passError.value = 'New password must be at least 6 characters.';
                return;
            }

            updatingPass.value = true;
            const res = await StudentApiService.changePassword(
                currentStudent.value.id,
                pass.value.current,
                pass.value.newPass
            );
            updatingPass.value = false;

            if (res.success) {
                updateSuccessMsg.value = 'Password changed successfully.';
                pass.value.current = '';
                pass.value.newPass = '';
                pass.value.confirm = '';
                passStrengthLevel.value = 0;
                setTimeout(() => { updateSuccessMsg.value = ''; }, 4000);
            } else {
                passError.value = res.message || 'Failed to update password.';
            }
        };

        // Logout Handlers — Purges Session & Redirects to login.html with SweetAlert2 Confirmation
        const handleLogout = () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Sign Out of Student Portal?',
                    text: 'Are you sure you want to end your active portal session?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#006A4E',
                    cancelButtonColor: '#6B7280',
                    confirmButtonText: '<i class="fas fa-right-from-bracket me-1"></i> Yes, Sign Out',
                    cancelButtonText: 'Cancel',
                    reverseButtons: true,
                    customClass: {
                        popup: 'rounded-4 shadow-lg border-0'
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        confirmLogout();
                    }
                });
            } else {
                confirmLogout();
            }
        };

        const confirmLogout = async () => {
            showLogoutConfirm.value = false;
            try {
                await StudentApiService.logout();
            } catch (e) {
                console.warn('[StudentPortal::Auth] Logout API call exception:', e);
            }
            currentStudent.value = null;
            sessionStorage.removeItem('gncp_portal_student');
            localStorage.removeItem('gncp_portal_student');
            window.location.href = 'login.html';
        };

        // Announcements State & Methods
        const announcements = ref([]);
        const activeCategory = ref('ALL');
        const likedPosts = reactive({});
        const activeImageModal = ref('');

        const fetchAnnouncements = async () => {
            try {
                const res = await fetch('../api/index.php?action=announcements/list');
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    announcements.value = json.data;
                }
            } catch (e) {
                console.error('[StudentPortal] Failed to fetch announcements:', e);
            }
        };

        const toggleLikePost = (postId) => {
            likedPosts[postId] = !likedPosts[postId];
        };

        const formatTimeAgo = (dateStr) => {
            if (!dateStr) return 'Just now';
            const date = new Date(dateStr);
            const now = new Date();
            const diffSec = Math.floor((now - date) / 1000);
            if (diffSec < 60) return 'Just now';
            if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
            if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
            if (diffSec < 604800) return Math.floor(diffSec / 86400) + 'd ago';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        let pollTimer = null;
        const startLiveSync = () => {
            stopLiveSync();
            pollTimer = setInterval(() => {
                fetchDashboardData(true);
                fetchAnnouncements();
            }, 10000);
        };

        const stopLiveSync = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        };

        onMounted(() => {
            checkSession();
            fetchAnnouncements();
            startLiveSync();
        });

        onUnmounted(() => {
            stopLiveSync();
        });

        return {
            currentStudent,
            profile: state.profile,
            roadmap: computed(() => state.roadmap),
            requirements: computed(() => state.requirements),
            medical: computed(() => state.medical),
            scholarship: computed(() => state.scholarship),
            payment: computed(() => state.payment),
            helpdesk: computed(() => state.helpdesk),
            enrollment: computed(() => state.enrollment),
            subjects: computed(() => state.subjects),
            corData: computed(() => state.corData),
            activeTab,
            currentTabTitle,
            totalUnits,
            totalAssignedSections,
            timeGreeting,
            isRefreshing,
            fetchDashboardData,
            printForm,
            handleLogout,
            showLogoutConfirm,
            confirmLogout,
            formatCurrency: StudentModel.formatCurrency,
            photoInput,
            updateSuccessMsg,
            triggerPhotoUpload,
            handlePhotoSelect,
            isMobileMenuOpen,
            studentForm,
            saving,
            updatingPass,
            pass,
            showCurrentPass,
            showNewPass,
            passStrengthLabel,
            passStrengthColor,
            passStrengthWidth,
            checkPassStrength,
            saveStudentPersonalInfo,
            updatePassword,
            passError,

            // Announcements
            announcements,
            activeCategory,
            likedPosts,
            activeImageModal,
            fetchAnnouncements,
            toggleLikePost,
            formatTimeAgo
        };
    }
};
