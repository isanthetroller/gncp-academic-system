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
                const s = queue[i];
                // Enforce sequential station workflow
                const step = s.roadmap ? s.roadmap.find(r => r.stepId === 'advising_assessment') : null;
                if (!step || step.status === 'PENDING') {
                    continue;
                }
                const help = s.helpdesk || {};
                const flatStudent = {
                    id: s.referenceNumber,
                    referenceNumber: s.referenceNumber,
                    name: s.name,
                    program: s.program,
                    studentType: s.studentType,
                    roadmap: s.roadmap,
                    medical: s.medical,
                    payment: s.payment,
                    form: s.form,
                    // Flatten helpdesk specific properties safely
                    nstp: help.nstp,
                    tlcNotes: help.tlcNotes,
                    status: help.status || 'PENDING',
                    prospectusSubjects: s.prospectusSubjects || [],
                    availableSections: s.availableSections || []
                };
                result.push(flatStudent);
            }
            students.value = result;
        };

        const checkSession = () => {
            const stored = sessionStorage.getItem('gncp_station_user') || sessionStorage.getItem('gncp_admin_user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.role === 'HELPDESK' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'REGISTRAR') {
                    currentUser.value = user;
                    loadQueue();
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
            window.location.href = '../../index.html';
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

        const filteredStudents = computed(() => {
            const query = searchQuery.value.trim().toLowerCase();
            const result = [];
            for (let i = 0; i < students.value.length; i++) {
                const student = students.value[i];
                
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
                } else if (activeFilter.value === 'Pending' && student.status === 'PENDING') {
                    matchesFilter = true;
                } else if ((activeFilter.value === 'Cleared' || activeFilter.value === 'Completed') && student.status === 'COMPLETED') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Flagged' && student.status === 'FLAGGED') {
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

        const pendingCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'PENDING') {
                    count++;
                }
            }
            return count;
        });

        const completedToday = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'COMPLETED') {
                    count++;
                }
            }
            return count;
        });

        const flaggedCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'FLAGGED') {
                    count++;
                }
            }
            return count;
        });

        const totalInQueue = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status !== 'COMPLETED') {
                    count++;
                }
            }
            return count;
        });

        const setView = (view) => {
            currentView.value = view;
        };

        const currentTitle = computed(() => {
            if (currentView.value === 'dashboard') return 'Dashboard';
            if (currentView.value === 'queue') return 'Student Queue';
            return '';
        });

        const openReview = (student) => {
            selectedStudent.value = student;
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('reviewModal'));
            modal.show();
        };

        const getStepIcon = (index) => {
            if (index === 0) return 'fa-solid fa-file-invoice';
            if (index === 1) return 'fa-solid fa-file-circle-check';
            if (index === 2) return 'fa-solid fa-headset';
            if (index === 3) return 'fa-solid fa-heart-pulse';
            if (index === 4) return 'fa-solid fa-credit-card';
            return 'fa-solid fa-id-card';
        };

        const persistStudentUpdate = (student) => {
            StationDataBus.updateStudent(student.referenceNumber, (s) => {
                s.helpdesk.status = student.status;
                s.helpdesk.nstp   = student.nstp;
                s.helpdesk.tlcNotes = student.tlcNotes;

                // Sync global roadmap advising step
                const currentStepIdx = (s.roadmap && Array.isArray(s.roadmap)) ? s.roadmap.findIndex(r => r.stepId === 'advising_assessment') : -1;
                if (currentStepIdx !== -1) {
                    if (student.status === 'COMPLETED') {
                        s.roadmap[currentStepIdx].status = 'COMPLETED';

                        // Compute dynamic tuition assessment based on prospectus subjects
                        const subjects = student.prospectusSubjects || [];
                        let totalUnits = 0;
                        let totalLabFee = 0;
                        subjects.forEach(sub => {
                            const lec = parseInt(sub.lecture_units) || 0;
                            const lab = parseInt(sub.lab_units) || 0;
                            totalUnits += (lec + lab);
                            totalLabFee += parseFloat(sub.lab_fee) || 0;
                        });

                        const tuition = totalUnits * 650;
                        const misc = 2300; // standard Registration (1500) + Library (800) fees
                        const totalAssessment = tuition + totalLabFee + misc;

                        // Update payment ledger dynamically
                        s.payment.totalFee = totalAssessment;
                        s.payment.balance = totalAssessment;
                        s.payment.amountPaid = 0;
                        s.payment.status = 'PENDING';

                        // Save advised subjects list in helpdesk data JSON
                        s.helpdesk.advisedSubjects = subjects;

                        // Auto-open next step (Medical Clearance)
                        const nextStep = s.roadmap.slice(currentStepIdx + 1).find(r => r.status === 'PENDING');
                        if (nextStep) {
                            nextStep.status = 'IN_PROGRESS';
                        }
                    } else if (student.status === 'FLAGGED') {
                        s.roadmap[currentStepIdx].status = 'FLAGGED';
                    } else {
                        s.roadmap[currentStepIdx].status = 'IN_PROGRESS';
                    }
                }
            });
            loadQueue();
        };

        const markCompleted = () => {
            if (!selectedStudent.value) return;
            selectedStudent.value.status = 'COMPLETED';
            persistStudentUpdate(selectedStudent.value);
            if (document.activeElement) {
                document.activeElement.blur();
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('reviewModal'));
            modal.hide();
        };

        const flagFollowUp = () => {
            if (!selectedStudent.value) return;
            selectedStudent.value.status = 'FLAGGED';
            persistStudentUpdate(selectedStudent.value);
            if (document.activeElement) {
                document.activeElement.blur();
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('reviewModal'));
            modal.hide();
        };

        const markAllCleared = () => {
            for (let i = 0; i < students.value.length; i++) {
                const student = students.value[i];
                if (student.status !== 'COMPLETED') {
                    student.status = 'COMPLETED';
                    persistStudentUpdate(student);
                }
            }
        };

        const setFilter = (filter) => {
            activeFilter.value = filter;
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

            // Live synchronization listener
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
            currentDateTime,
            currentView,
            currentTitle,
            searchQuery,
            activeFilter,
            sortBy,
            sortDesc,
            toggleSort,
            getSortIcon,
            selectedStudent,
            students,
            filteredStudents,
            pendingCount,
            completedToday,
            flaggedCount,
            totalInQueue,
            setView,
            openReview,
            markCompleted,
            flagFollowUp,
            markAllCleared,
            setFilter,
            getStepIcon,
            formatStatus,
            getStatusBadgeClass,
            currentUser,
            isLoggingIn,
            loginError,
            loginForm,
            handleLogout,
            showLogoutConfirm,
            confirmLogout
        };
    }
}).mount('#app');
