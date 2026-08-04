const createApp = Vue.createApp;
const ref = Vue.ref;
const reactive = Vue.reactive;
const computed = Vue.computed;
const onMounted = Vue.onMounted;

createApp({
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



        const showLogoutConfirm = ref(false);

        const handleLogout = () => {
            showLogoutConfirm.value = true;
        };

        const confirmLogout = () => {
            showLogoutConfirm.value = false;
            currentUser.value = null;
            sessionStorage.removeItem('gncp_station_user');
            sessionStorage.removeItem('gncp_admin_user');
            localStorage.removeItem('gncp_station_user');
            localStorage.removeItem('gncp_admin_user');

            fetch('../../api/index.php?action=auth/logout', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    window.location.href = '../../index.html?clear=true';
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
                        s.medical.verifiedBy = currentUser.value.name;
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
            setInterval(updateTime, 1000);

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
            timeGreeting
        };
    }
}).mount('#app');
