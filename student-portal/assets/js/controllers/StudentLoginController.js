/**
 * Student Portal - Login Controller
 * Manages student authentication, saved credentials, and SMTP password reset.
 */

window.StudentLoginController = {
    setup() {
        const { ref, reactive, onMounted } = Vue;

        // Auth Form State
        const isLoggingIn = ref(false);
        const loginError = ref('');
        const showPassword = ref(false);
        const rememberMe = ref(true);
        const hasSavedCredentials = ref(false);

        const loginForm = reactive({
            studentId: '',
            password: ''
        });

        // Forgot Password Modal State
        const showForgotPasswordModal = ref(false);
        const forgotPasswordStep = ref(1); // 1 = Request Code, 2 = Verify Code & New Password
        const forgotIdentifier = ref('');
        const forgotCode = ref('');
        const forgotNewPassword = ref('');
        const forgotConfirmPassword = ref('');
        const forgotShowNewPass = ref(false);
        const isRequestingCode = ref(false);
        const isResettingPass = ref(false);
        const forgotMsg = ref('');
        const forgotError = ref('');
        const maskedEmailSent = ref('');

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
            if (params.get('clear') === 'true') {
                sessionStorage.clear();
                localStorage.clear();
                return;
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

        // Forgot Password Handlers
        const openForgotPasswordModal = () => {
            forgotPasswordStep.value = 1;
            forgotIdentifier.value = loginForm.studentId || '';
            forgotCode.value = '';
            forgotNewPassword.value = '';
            forgotConfirmPassword.value = '';
            forgotMsg.value = '';
            forgotError.value = '';
            maskedEmailSent.value = '';
            showForgotPasswordModal.value = true;
        };

        const closeForgotPasswordModal = () => {
            showForgotPasswordModal.value = false;
        };

        const handleRequestResetCode = async () => {
            if (!forgotIdentifier.value.trim()) {
                forgotError.value = 'Please enter your Student ID or Email address.';
                return;
            }

            isRequestingCode.value = true;
            forgotError.value = '';
            forgotMsg.value = '';

            const res = await StudentApiService.requestPasswordReset(forgotIdentifier.value.trim());
            isRequestingCode.value = false;

            if (!res.success) {
                forgotError.value = res.message || 'Failed to request password reset code.';
                return;
            }

            maskedEmailSent.value = res.data?.maskedEmail || 'your email';
            forgotMsg.value = res.message || `Verification code sent to ${maskedEmailSent.value}.`;
            forgotPasswordStep.value = 2;
        };

        const handleResetPassword = async () => {
            if (!forgotCode.value.trim()) {
                forgotError.value = 'Please enter the 6-digit verification code sent to your email.';
                return;
            }
            if (!forgotNewPassword.value) {
                forgotError.value = 'Please enter your new password.';
                return;
            }
            if (forgotNewPassword.value.length < 6) {
                forgotError.value = 'New password must be at least 6 characters long.';
                return;
            }
            if (forgotNewPassword.value !== forgotConfirmPassword.value) {
                forgotError.value = 'Passwords do not match.';
                return;
            }

            isResettingPass.value = true;
            forgotError.value = '';
            forgotMsg.value = '';

            const res = await StudentApiService.resetPasswordWithCode(
                forgotIdentifier.value.trim(),
                forgotCode.value.trim(),
                forgotNewPassword.value
            );
            isResettingPass.value = false;

            if (!res.success) {
                forgotError.value = res.message || 'Failed to reset password.';
                return;
            }

            forgotMsg.value = 'Password reset successfully! You can now log into your GNCP Student Portal.';
            setTimeout(() => {
                showForgotPasswordModal.value = false;
                loginForm.studentId = forgotIdentifier.value.trim();
                loginForm.password = forgotNewPassword.value;
            }, 1800);
        };

        onMounted(() => {
            checkActiveSession();
            loadSavedCredentials();
        });

        return {
            isLoggingIn,
            loginError,
            loginForm,
            showPassword,
            rememberMe,
            hasSavedCredentials,
            clearSavedCredentials,
            handleLogin,
            // Forgot Password Expose
            showForgotPasswordModal,
            forgotPasswordStep,
            forgotIdentifier,
            forgotCode,
            forgotNewPassword,
            forgotConfirmPassword,
            forgotShowNewPass,
            isRequestingCode,
            isResettingPass,
            forgotMsg,
            forgotError,
            maskedEmailSent,
            openForgotPasswordModal,
            closeForgotPasswordModal,
            handleRequestResetCode,
            handleResetPassword
        };
    }
};
