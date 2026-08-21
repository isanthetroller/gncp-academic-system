/**
 * Student Portal - Login Controller
 * Manages student authentication, saved credentials, and session validation.
 */

window.StudentLoginController = {
    setup() {
        const { ref, reactive, onMounted } = Vue;

        // Auth Form State
        const isLoggingIn = ref(false);
        const loginError = ref('');
        const resetSuccessMsg = ref('');
        const showPassword = ref(false);
        const rememberMe = ref(true);
        const hasSavedCredentials = ref(false);

        const loginForm = reactive({
            studentId: '',
            password: ''
        });

        // Saved Credentials Storage Handler
        const loadSavedCredentials = () => {
            try {
                const saved = localStorage.getItem('gncp_saved_student_credentials');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.studentId) loginForm.studentId = parsed.studentId;
                    if (parsed.password) loginForm.password = parsed.password;
                    hasSavedCredentials.value = true;
                    rememberMe.value = true;
                }
            } catch (e) {
                console.error('[StudentLogin::Auth] Error reading saved credentials:', e);
            }
        };

        const clearSavedCredentials = () => {
            loginForm.studentId = '';
            loginForm.password = '';
            localStorage.removeItem('gncp_saved_student_credentials');
            hasSavedCredentials.value = false;
        };

        // Session Pre-Check: Forward to index.html if already logged in
        const checkActiveSession = () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('clear') === 'true' || params.get('logout') === 'true') {
                sessionStorage.removeItem('gncp_portal_student');
                localStorage.removeItem('gncp_portal_student');
                return;
            }

            if (params.get('reset') === 'success') {
                resetSuccessMsg.value = 'Your password has been reset successfully. Please sign in with your new credentials.';
                if (params.get('id')) {
                    loginForm.studentId = params.get('id');
                }
            }

            const stored = sessionStorage.getItem('gncp_portal_student') || localStorage.getItem('gncp_portal_student');
            if (stored) {
                try {
                    const student = JSON.parse(stored);
                    if (student && (student.id || student.studentId)) {
                        console.log('[StudentLogin::Auth] Active session found. Redirecting to index.html...');
                        window.location.href = 'index.html';
                    }
                } catch (e) {
                    sessionStorage.removeItem('gncp_portal_student');
                    localStorage.removeItem('gncp_portal_student');
                }
            }
        };

        // Handle Login Submission
        const handleLogin = async () => {
            if (!loginForm.studentId || !loginForm.password) {
                loginError.value = 'Please enter your Student ID and password.';
                return;
            }

            isLoggingIn.value = true;
            loginError.value = '';
            resetSuccessMsg.value = '';

            const res = await StudentApiService.login(loginForm.studentId, loginForm.password);
            isLoggingIn.value = false;

            if (res.success && res.data) {
                console.log('[StudentLogin::Auth] Login success. Redirecting to index.html...');
                sessionStorage.setItem('gncp_portal_student', JSON.stringify(res.data));

                if (rememberMe.value) {
                    localStorage.setItem('gncp_saved_student_credentials', JSON.stringify({
                        studentId: loginForm.studentId,
                        password: loginForm.password
                    }));
                    hasSavedCredentials.value = true;
                } else {
                    localStorage.removeItem('gncp_saved_student_credentials');
                    hasSavedCredentials.value = false;
                }

                window.location.href = 'index.html';
            } else {
                loginError.value = res.message || 'Failed to authenticate student credentials.';
            }
        };

        onMounted(() => {
            checkActiveSession();
            loadSavedCredentials();
        });

        return {
            isLoggingIn,
            loginError,
            resetSuccessMsg,
            loginForm,
            showPassword,
            rememberMe,
            hasSavedCredentials,
            clearSavedCredentials,
            handleLogin
        };
    }
};
