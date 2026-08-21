const createApp = Vue.createApp;
const ref = Vue.ref;
const reactive = Vue.reactive;
const computed = Vue.computed;
const onMounted = Vue.onMounted;
const onUnmounted = Vue.onUnmounted;

window.app = createApp({
    components: {
        'employee-sidebar': window.EmployeeSidebar || window.StationSidebar,
        'station-sidebar': window.StationSidebar || window.EmployeeSidebar
    },
    setup() {
        const currentView = ref('dashboard');
        const searchQuery = ref('');
        const activeFilter = ref('All');
        const sortBy = ref('referenceNumber');
        const sortDesc = ref(false);
        const selectedStudent = ref(null);
        const students = ref([]);

        const timeGreeting = computed(() => {
            const hour = new Date().getHours();
            if (hour < 12) return 'Great Morning';
            if (hour < 18) return 'Great Afternoon';
            return 'Great Evening';
        });

        const setFilter = (filter) => {
            activeFilter.value = filter;
        };

        const toggleSort = (field) => {
            if (sortBy.value === field) {
                sortDesc.value = !sortDesc.value;
            } else {
                sortBy.value = field;
                sortDesc.value = false;
            }
        };

        const getSortIcon = (field) => {
            if (sortBy.value !== field) return 'fa-solid fa-sort text-muted ms-1';
            return sortDesc.value ? 'fa-solid fa-sort-down text-success ms-1' : 'fa-solid fa-sort-up text-success ms-1';
        };

        const getMedicalStepStatus = (student) => {
            if (!student) return 'PENDING';
            if (student.medical && (student.medical.status === 'fit' || student.medical.status === 'cleared' || student.medical.status === 'conditional' || student.medical.verifiedBy)) {
                return 'COMPLETED';
            }
            if (!student.roadmap) return 'PENDING';
            const step = student.roadmap.find(r => r.stepId === 'clinic_checkup');
            return step ? step.status : 'PENDING';
        };

        const completedStudents = computed(() => {
            const list = [];
            for (let i = 0; i < students.value.length; i++) {
                const s = students.value[i];
                if (getMedicalStepStatus(s) === 'COMPLETED') {
                    list.push(s);
                }
            }
            return [...list].sort((a, b) => {
                let vA = a[sortBy.value] || '';
                let vB = b[sortBy.value] || '';
                if (typeof vA === 'string') vA = vA.toLowerCase();
                if (typeof vB === 'string') vB = vB.toLowerCase();
                if (vA < vB) return sortDesc.value ? 1 : -1;
                if (vA > vB) return sortDesc.value ? -1 : 1;
                return 0;
            });
        });

        const filteredStudents = computed(() => {
            const query = searchQuery.value.trim().toLowerCase();
            const result = [];
            for (let i = 0; i < students.value.length; i++) {
                const student = students.value[i];
                const stepStatus = getMedicalStepStatus(student);
                
                // Matches query
                let matchesQuery = true;
                if (query) {
                    const nameMatches = student.name.toLowerCase().indexOf(query) !== -1;
                    const refMatches = student.referenceNumber.toLowerCase().indexOf(query) !== -1;
                    matchesQuery = nameMatches || refMatches;
                }

                // Matches filter
                let matchesFilter = false;
                if (activeFilter.value === 'All') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Pending' && stepStatus !== 'COMPLETED') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Completed' && stepStatus === 'COMPLETED') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Conditional' && (student.status === 'conditional' || student.status === 'unfit' || stepStatus === 'FLAGGED')) {
                    matchesFilter = true;
                }

                if (matchesQuery && matchesFilter) {
                    result.push(student);
                }
            }

            // Registrar Sorting Logic
            return [...result].sort((a, b) => {
                let vA = a[sortBy.value] || '';
                let vB = b[sortBy.value] || '';
                if (typeof vA === 'string') vA = vA.toLowerCase();
                if (typeof vB === 'string') vB = vB.toLowerCase();
                if (vA < vB) return sortDesc.value ? 1 : -1;
                if (vA > vB) return sortDesc.value ? -1 : 1;
                return 0;
            });
        });

        // Authentication State
        const currentUser = ref(null);
        const isLoggingIn = ref(false);
        const loginError = ref('');
        const loginForm = reactive({
            username: '',
            password: ''
        });

        const loadQueue = () => {
            const queue = StationDataBus.getQueue();
            const result = [];
            for (let i = 0; i < queue.length; i++) {
                const student = queue[i];
                // Only show students whose clinic_checkup step is IN_PROGRESS or later
                const step = student.roadmap ? student.roadmap.find(r => r.stepId === 'clinic_checkup') : null;
                if (!step || step.status === 'PENDING') {
                    continue;
                }
                const form = student.form || {};
                // Safely default all medical fields to avoid undefined in the UI
                const med = student.medical && typeof student.medical === 'object' ? student.medical : {};
                
                const s = {
                    referenceNumber: student.referenceNumber,
                    name: student.name,
                    program: student.program,
                    studentType: student.studentType,
                    roadmap: student.roadmap,
                    medical: med,
                    payment: student.payment,
                    scholarship: student.scholarship,
                    form: student.form,
                    status: med.status || 'pending',
                    physicalExam: med.physicalExam || 'not-assessed',
                    medicalInterview: med.medicalInterview || 'not-assessed',
                    peFitness: med.peFitness || 'not-assessed',
                    nstpFitness: med.nstpFitness || 'not-assessed',
                    notes: med.notes || '',
                    verifiedBy: med.verifiedBy || '',
                    dateVerified: med.dateVerified || '',
                    // Student pre-registration medical declarations
                    healthStatus: form.healthStatus || 'GOOD',
                    medicalConditions: form.medicalConditions || [],
                    allergies: form.allergies || 'None',
                    currentMedication: form.currentMedication !== undefined ? form.currentMedication : false,
                    medicationDetails: form.medicationDetails || ''
                };
                result.push(s);
            }
            students.value = result;
        };

        const fetchCurrentProfile = () => {
            fetch('../../api/index.php?action=auth/profile')
                .then(res => res.json())
                .then(res => {
                    if (res && res.success && res.data) {
                        const prof = res.data;
                        const avatarUrl = prof.avatar || prof.photo || prof.image || null;
                        if (avatarUrl && currentUser.value) {
                            currentUser.value.avatar = avatarUrl;
                            if (prof.name) currentUser.value.name = prof.name;
                            const key = (currentUser.value.role === 'SUPER_ADMIN' || currentUser.value.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                            sessionStorage.setItem(key, JSON.stringify(currentUser.value));
                        }
                    }
                }).catch(() => {});
        };

        const checkSession = () => {
            const stored = sessionStorage.getItem('gncp_station_user') || sessionStorage.getItem('gncp_admin_user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.role === 'MEDICAL' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'REGISTRAR') {
                    currentUser.value = user;
                    fetchCurrentProfile();
                    if (user.must_change_password && typeof window.PasswordChangeGuard !== 'undefined') {
                        window.PasswordChangeGuard.checkAndPrompt(user, function() {
                            loadQueue();
                        });
                    } else {
                        loadQueue();
                    }
                    return;
                }
            }
            sessionStorage.removeItem('gncp_station_user');
            sessionStorage.removeItem('gncp_admin_user');
            window.location.href = '../../index.html?clear=true&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        };



        let clockTimer = null;
        const stopLiveSync = () => {
            if (clockTimer) {
                clearInterval(clockTimer);
                clockTimer = null;
            }
            if (window.StationDataBus && typeof window.StationDataBus.stopPolling === 'function') {
                window.StationDataBus.stopPolling();
            }
        };

        const showLogoutConfirm = ref(false);

        const handleLogout = () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Confirm Logout',
                    text: 'Are you sure you want to log out of the Medical Checkup Workstation?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc2626',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: '<i class="fa-solid fa-right-from-bracket me-1"></i> Log Out',
                    cancelButtonText: 'Cancel',
                    reverseButtons: true,
                    customClass: {
                        popup: 'gncp-swal-card',
                        title: 'gncp-swal-title',
                        confirmButton: 'gncp-swal-confirm-btn',
                        cancelButton: 'gncp-swal-cancel-btn'
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        confirmLogout();
                    }
                });
            } else {
                showLogoutConfirm.value = true;
            }
        };

        const confirmLogout = () => {
            showLogoutConfirm.value = false;
            stopLiveSync();
            currentUser.value = null;
            sessionStorage.removeItem('gncp_station_user');
            sessionStorage.removeItem('gncp_admin_user');
            localStorage.removeItem('gncp_station_user');
            localStorage.removeItem('gncp_admin_user');

            fetch('../../api/index.php?action=auth/logout', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    window.location.replace('../../index.html?clear=true&logout=true');
                });
        };

        const isMedicalStepCompleted = (student) => {
            return getMedicalStepStatus(student) === 'COMPLETED';
        };

        const pendingCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                const stat = getMedicalStepStatus(students.value[i]);
                if (stat === 'IN_PROGRESS' || stat === 'PENDING' || stat === 'FLAGGED') {
                    count++;
                }
            }
            return count;
        });

        const completedCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (getMedicalStepStatus(students.value[i]) === 'COMPLETED') {
                    count++;
                }
            }
            return count;
        });

        const fitCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'fit') {
                    count++;
                }
            }
            return count;
        });

        const unfitCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'unfit') {
                    count++;
                }
            }
            return count;
        });

        const setView = (view) => {
            currentView.value = view;
        };

        const openReview = (student) => {
            selectedStudent.value = student;
            // Use getOrCreateInstance so the modal works even if it wasn't pre-initialized
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('checkupModal'));
            modal.show();
        };

        const badgeClass = (status) => {
            if (!status) return '';
            return status.toLowerCase().replace(/\s+/g, '-');
        };

        const getStepIcon = (index) => {
            if (index === 0) return 'fa-solid fa-file-invoice';
            if (index === 1) return 'fa-solid fa-file-circle-check';
            if (index === 2) return 'fa-solid fa-headset';
            if (index === 3) return 'fa-solid fa-heart-pulse';
            if (index === 4) return 'fa-solid fa-award';
            if (index === 5) return 'fa-solid fa-credit-card';
            return 'fa-solid fa-id-card';
        };

        const persistStudentUpdate = (student) => {
            StationDataBus.updateStudent(student.referenceNumber, (s) => {
                // Ensure medical object exists before writing to it
                if (!s.medical || typeof s.medical !== 'object') {
                    s.medical = {};
                }
                s.medical.status = student.status;
                s.medical.physicalExam = student.physicalExam;
                s.medical.medicalInterview = student.medicalInterview;
                s.medical.peFitness = student.peFitness;
                s.medical.nstpFitness = student.nstpFitness;
                s.medical.notes = student.notes;

                // Sync global roadmap steps
                const currentStepIdx = (s.roadmap && Array.isArray(s.roadmap)) ? s.roadmap.findIndex(r => r.stepId === 'clinic_checkup') : -1;
                if (currentStepIdx !== -1) {
                    if (student.status === 'fit' || student.status === 'conditional') {
                        s.medical.verifiedBy = currentUser.value?.name || currentUser.value?.username || 'Medical Officer';
                        s.medical.dateVerified = new Date().toLocaleDateString();
                        s.roadmap[currentStepIdx].status = 'COMPLETED';
                        
                        // Open next station step: Cashier / Treasury
                        const nextStep = s.roadmap.slice(currentStepIdx + 1).find(r => r.status === 'PENDING');
                        if (nextStep) {
                            nextStep.status = 'IN_PROGRESS';
                        }
                    } else if (student.status === 'unfit') {
                        s.roadmap[currentStepIdx].status = 'FLAGGED';
                    } else {
                        s.roadmap[currentStepIdx].status = 'IN_PROGRESS';
                    }
                }
            }, ['medical', 'roadmap']); // Delta: only send medical + roadmap fields
            loadQueue();
        };

        const saveCheckup = () => {
            if (selectedStudent.value) {
                persistStudentUpdate(selectedStudent.value);
            }
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
            const modalEl = document.getElementById('checkupModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.hide();
            }
        };

        const currentDateTime = ref('');
        const updateTime = () => {
            currentDateTime.value = new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        };

        onMounted(() => {
            checkSession();
            updateTime();
            clockTimer = setInterval(updateTime, 1000);

            document.addEventListener('hide.bs.modal', () => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            });

            // When the DataBus syncs fresh data from the server it fires a 'storage' event.
            // We listen here so the queue updates reactively without needing a page refresh.
            window.addEventListener('storage', () => {
                if (currentUser.value) {
                    loadQueue();
                }
            });
        });

        onUnmounted(() => {
            stopLiveSync();
        });

        const formatStatus = (status) => {
            if (!status) return 'Pending';
            const s = String(status).toUpperCase();
            if (['COMPLETED', 'CLEARED', 'FIT', 'VERIFIED', 'PAID', 'ACTIVATED', 'ENROLLED'].includes(s)) return 'Completed';
            if (['IN_PROGRESS', 'IN-PROGRESS', 'PARTIAL', 'CONDITIONAL'].includes(s)) return 'In Progress';
            if (['FLAGGED', 'DISCREPANCY', 'UNFIT', 'REJECTED'].includes(s)) return 'Flagged';
            if (s === 'SKIPPED') return 'Skipped';
            if (s === 'PENDING') return 'Pending';
            return status;
        };

        const getStatusBadgeClass = (status) => {
            if (!status) return 'pending';
            const s = String(status).toLowerCase().replace('_', '-');
            if (['completed', 'cleared', 'fit', 'verified', 'paid', 'activated', 'enrolled'].includes(s)) return 'completed';
            if (['in-progress', 'in_progress', 'partial', 'conditional'].includes(s)) return 'in-progress';
            if (['flagged', 'discrepancy', 'unfit', 'rejected'].includes(s)) return 'flagged';
            if (['skipped'].includes(s)) return 'archived';
            return s;
        };

        // ── IN-APP ACCOUNT PROFILE & SECURITY MANAGEMENT ──────────────────────
        const user = ref({ name: '', email: '', username: '', role: '', avatar: null });
        const pass = ref({ current: '', newPass: '', confirm: '' });
        const saving = ref(false);
        const updatingPass = ref(false);
        const showCurrentPass = ref(false);
        const showNewPass = ref(false);
        const fileInput = ref(null);
        const passStrengthLevel = ref(0);
        const avatarFailed = ref(false);

        const initials = computed(() => {
            const name = user.value.name || (currentUser.value ? currentUser.value.name : 'Medical Staff');
            const parts = name.trim().split(' ');
            return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0][0].toUpperCase();
        });

        const formattedAvatar = computed(() => {
            const avatar = user.value.avatar || (currentUser.value ? currentUser.value.avatar : null);
            if (!avatar) return null;
            if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) return avatar;
            const filename = avatar.split('/').pop();
            return '../../uploads/avatars/' + filename;
        });

        const passStrengthLabel = computed(() => {
            const l = passStrengthLevel.value;
            if (l <= 1) return 'Weak'; if (l === 2) return 'Fair'; if (l === 3) return 'Good'; return 'Strong';
        });
        const passStrengthColor = computed(() => {
            const l = passStrengthLevel.value;
            if (l <= 1) return '#ef4444'; if (l === 2) return '#f59e0b'; if (l === 3) return '#10b981'; return '#059669';
        });
        const passStrengthWidth = computed(() => (passStrengthLevel.value / 4 * 100) + '%');

        function checkPassStrength() {
            const p = pass.value.newPass;
            let score = 0;
            if (p.length >= 8) score++; if (/[A-Z]/.test(p)) score++; if (/[0-9]/.test(p)) score++; if (/[^A-Za-z0-9]/.test(p)) score++;
            passStrengthLevel.value = Math.max(p.length >= 6 ? 1 : 0, score);
        }

        function triggerFileInput() { if (fileInput.value) fileInput.value.click(); }

        const loadProfile = async () => {
            if (currentUser.value) {
                user.value.name = currentUser.value.name || '';
                user.value.email = currentUser.value.email || '';
                user.value.username = currentUser.value.username || 'medical';
                user.value.role = currentUser.value.role || 'MEDICAL';
                user.value.avatar = currentUser.value.avatar || null;
            }
            try {
                const username = user.value.username || 'medical';
                const res = await fetch('../../api/index.php?action=auth/profile&username=' + encodeURIComponent(username));
                const data = await res.json();
                if (data.success && data.data) {
                    user.value = { ...user.value, ...data.data };
                }
            } catch (e) { console.error('[Profile] Staff fetch failed:', e); }
        };

        const onFileSelected = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { Swal.fire('File Too Large', 'Please select an image smaller than 5MB.', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const b64 = ev.target.result;
                try {
                    const res = await fetch('../../api/index.php?action=auth/upload_avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: user.value.username || 'medical', photoData: b64 })
                    });
                    const data = await res.json();
                    if (data.success && data.data) {
                        const newFilename = data.data.avatar || data.data.photo;
                        user.value.avatar = newFilename;
                        if (currentUser.value) currentUser.value.avatar = newFilename;
                        const raw = sessionStorage.getItem('gncp_station_user');
                        if (raw) {
                            const p = JSON.parse(raw);
                            p.avatar = newFilename;
                            sessionStorage.setItem('gncp_station_user', JSON.stringify(p));
                        }
                        Swal.fire('Success', 'Profile picture updated successfully.', 'success');
                    } else { Swal.fire('Upload Failed', data.message || 'Unable to update profile picture.', 'error'); }
                } catch (err) { Swal.fire('Error', 'Unable to process image upload.', 'error'); }
            };
            reader.readAsDataURL(file);
        };

        const saveStaffProfile = async () => {
            saving.value = true;
            try {
                const avatarFilename = user.value.avatar ? user.value.avatar.split('/').pop() : null;
                const res = await fetch('../../api/index.php?action=auth/update_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: user.value.username,
                        name: user.value.name,
                        email: user.value.email,
                        avatar: avatarFilename
                    })
                });
                const data = await res.json();
                if (data.success) {
                    if (currentUser.value) {
                        currentUser.value.name = user.value.name;
                        currentUser.value.email = user.value.email;
                        currentUser.value.avatar = avatarFilename;
                    }
                    const raw = sessionStorage.getItem('gncp_station_user');
                    if (raw) {
                        const p = JSON.parse(raw);
                        p.name = user.value.name;
                        p.email = user.value.email;
                        p.avatar = avatarFilename;
                        sessionStorage.setItem('gncp_station_user', JSON.stringify(p));
                    }
                    Swal.fire('Success', 'Personal details updated successfully.', 'success');
                } else { Swal.fire('Update Failed', data.message || 'Unable to update profile.', 'error'); }
            } catch (e) { Swal.fire('Error', 'Server error while saving profile.', 'error'); }
            finally { saving.value = false; }
        };

        const updatePassword = async () => {
            if (pass.value.newPass !== pass.value.confirm) { Swal.fire('Password Mismatch', 'New password and confirm password do not match.', 'warning'); return; }
            if (pass.value.newPass.length < 6) { Swal.fire('Weak Password', 'New password must be at least 6 characters.', 'warning'); return; }
            updatingPass.value = true;
            try {
                const res = await fetch('../../api/index.php?action=auth/change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.value.username, current_password: pass.value.current, new_password: pass.value.newPass })
                });
                const data = await res.json();
                if (data.success) {
                    pass.value = { current: '', newPass: '', confirm: '' };
                    passStrengthLevel.value = 0;
                    Swal.fire('Success', 'Password changed successfully.', 'success');
                } else { Swal.fire('Password Error', data.message || 'Unable to update password.', 'error'); }
            } catch (e) { Swal.fire('Error', 'Server connection error while changing password.', 'error'); }
            finally { updatingPass.value = false; }
        };

        return {
            currentView,
            currentDateTime,
            searchQuery,
            activeFilter,
            sortBy,
            sortDesc,
            setFilter,
            toggleSort,
            getSortIcon,
            students,
            filteredStudents,
            completedStudents,
            selectedStudent,
            pendingCount,
            completedCount,
            fitCount,
            unfitCount,
            setView,
            openReview,
            badgeClass: getStatusBadgeClass,
            getStepIcon,
            saveCheckup,
            formatStatus,
            currentUser,
            isLoggingIn,
            loginError,
            loginForm,
            handleLogout,
            showLogoutConfirm,
            confirmLogout,
            getMedicalStepStatus,
            isMedicalStepCompleted,
            timeGreeting,
            // Profile & Security
            user, pass, saving, updatingPass, showCurrentPass, showNewPass, fileInput,
            passStrengthLevel, passStrengthLabel, passStrengthColor, passStrengthWidth,
            initials, formattedAvatar, checkPassStrength, triggerFileInput, onFileSelected,
            saveStaffProfile, updatePassword, loadProfile
        };
    }
}).mount('#app');
