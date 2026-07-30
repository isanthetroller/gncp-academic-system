// Go-on National College of the Philippines — Tracker App Service
(function () {
    const createApp = Vue.createApp;
    const ref = Vue.ref;
    const reactive = Vue.reactive;
    const computed = Vue.computed;
    const onMounted = Vue.onMounted;

    createApp({
        setup() {
            const currentView = ref('LOGIN'); // 'LOGIN' | 'LOADING' | 'DASHBOARD'
            const isLoading = ref(false);
            const loginError = ref('');

            const loginForm = reactive({
                tempStudentId: '',
                tempPin: ''
            });

            const enrollmentData = ref(null);

            // Check URL parameters for auto-login demo support e.g. tracker.html?id=GNCP-2026-123456&pin=654321
            onMounted(() => {
                const params = new URLSearchParams(window.location.search);
                const autoId = params.get('id');
                const autoPin = params.get('pin');
                if (autoId && autoPin) {
                    loginForm.tempStudentId = autoId;
                    loginForm.tempPin = autoPin;
                    handleLogin();
                }
            });

            const handleLogin = () => {
                if (!loginForm.tempStudentId.trim() || !loginForm.tempPin.trim()) {
                    loginError.value = 'Please enter both your Student ID and PIN.';
                    return;
                }

                isLoading.value = true;
                loginError.value = '';

                window.ApiService.getEnrollment(loginForm.tempStudentId, loginForm.tempPin)
                    .then(res => {
                        isLoading.value = false;
                        if (res.success) {
                            enrollmentData.value = res.data;
                            currentView.value = 'DASHBOARD';
                        } else {
                            loginError.value = res.error || 'Failed to authenticate.';
                        }
                    })
                    .catch(err => {
                        isLoading.value = false;
                        console.error('Tracker Login Error:', err);
                        loginError.value = 'Network or server error. Please try again.';
                    });
            };

            const logout = () => {
                enrollmentData.value = null;
                loginForm.tempStudentId = '';
                loginForm.tempPin = '';
                currentView.value = 'LOGIN';
            };

            // Computed metrics for dashboard
            const completedCount = computed(() => {
                if (!enrollmentData.value || !enrollmentData.value.roadmap) return 0;
                let count = 0;
                for (let i = 0; i < enrollmentData.value.roadmap.length; i++) {
                    if (enrollmentData.value.roadmap[i].status === 'COMPLETED') {
                        count++;
                    }
                }
                return count;
            });

            const progressPercent = computed(() => {
                if (!enrollmentData.value || !enrollmentData.value.roadmap) return 0;
                const total = enrollmentData.value.roadmap.length;
                return Math.round((completedCount.value / total) * 100);
            });

            const nextPendingStep = computed(() => {
                if (!enrollmentData.value || !enrollmentData.value.roadmap) return null;
                for (let i = 0; i < enrollmentData.value.roadmap.length; i++) {
                    const status = enrollmentData.value.roadmap[i].status;
                    if (status === 'PENDING' || status === 'IN_PROGRESS') {
                        return enrollmentData.value.roadmap[i];
                    }
                }
                return null;
            });

            const getStudentTypeLabel = (val) => {
                if (val === 'FRESHMAN') return 'Incoming Freshman';
                if (val === 'TRANSFEREE') return 'College Transferee';
                if (val === 'RETURNING') return 'Returning Student';
                return val;
            };

            const formatDate = (isoStr) => {
                if (!isoStr) return '';
                return new Date(isoStr).toLocaleString();
            };

            return {
                currentView,
                isLoading,
                loginError,
                loginForm,
                enrollmentData,
                handleLogin,
                logout,
                completedCount,
                progressPercent,
                nextPendingStep,
                getStudentTypeLabel,
                formatDate
            };
        }
    }).mount('#tracker-app');
})();
