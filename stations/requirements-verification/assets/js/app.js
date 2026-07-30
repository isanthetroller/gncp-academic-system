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

        // Authentication State
        const currentUser = ref(null);
        const isLoggingIn = ref(false);
        const loginError = ref('');
        const loginForm = reactive({
            username: '',
            password: ''
        });

        const loadQueue = () => {
            // ── STATION DISABLED ─────────────────────────────────────────────────
            // Requirements Verification has been removed from the enrollment flow.
            // Students now go from Registrar Verification directly to Academic
            // Advising (TLC Helpdesk). This station is no longer in the workflow.
            // ─────────────────────────────────────────────────────────────────────
            students.value = [];
        };

        const checkSession = () => {
            const stored = sessionStorage.getItem('gncp_station_user') || sessionStorage.getItem('gncp_admin_user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.role === 'REGISTRAR' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
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
        updateTime();
        setInterval(updateTime, 1000);

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
                } else if (activeFilter.value === 'Verified' && student.status === 'VERIFIED') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Discrepancy' && student.status === 'DISCREPANCY') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'Completed' && student.status === 'COMPLETED') {
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

        const verifiedToday = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'COMPLETED') {
                    count++;
                }
            }
            return count;
        });

        const discrepancyCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'DISCREPANCY') {
                    count++;
                }
            }
            return count;
        });

        const completedCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'COMPLETED' || students.value[i].status === 'VERIFIED') {
                    count++;
                }
            }
            return count;
        });

        const totalInQueue = computed(() => {
            return students.value.length;
        });

        const verifiedDocsCount = computed(() => {
            if (!selectedStudent.value || !selectedStudent.value.docs) return 0;
            let count = 0;
            const docs = selectedStudent.value.docs;
            if (docs.psa === 'verified') count++;
            if (docs.reportCard === 'verified') count++;
            if (docs.goodMoral === 'verified') count++;
            return count;
        });

        const setView = (view) => {
            currentView.value = view;
        };

        const openReview = (student) => {
            selectedStudent.value = student;
            if (modalInstance.value) {
                modalInstance.value.show();
            }
        };

        const statusClass = (status) => {
            if (status === 'VERIFIED') return 'status-verified';
            if (status === 'DISCREPANCY') return 'status-discrepancy';
            if (status === 'COMPLETED') return 'status-completed';
            return 'status-pending';
        };

        const badgeLabel = (status) => {
            if (status === 'VERIFIED') return 'Verified';
            if (status === 'DISCREPANCY') return 'Discrepancy';
            if (status === 'COMPLETED') return 'Completed';
            return 'Pending Review';
        };

        const documentSubmissionCount = (student) => {
            if (!student || !student.docs) return 0;
            let submitted = 0;
            if (student.docs.psa && student.docs.psa !== 'not-submitted') submitted++;
            if (student.docs.reportCard && student.docs.reportCard !== 'not-submitted') submitted++;
            if (student.docs.goodMoral && student.docs.goodMoral !== 'not-submitted') submitted++;
            return submitted;
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
                s.requirements.status       = student.status;
                s.requirements.docs.psa      = student.docs.psa;
                s.requirements.docs.reportCard = student.docs.reportCard;
                s.requirements.docs.goodMoral = student.docs.goodMoral;
                s.requirements.notes        = student.registrarNotes;

                // Set step 1 updates
                if (student.status === 'VERIFIED') {
                    s.requirements.verifiedBy = currentUser.value.name;
                    s.requirements.dateVerified = new Date().toLocaleDateString();
                    s.roadmap[1].status = 'COMPLETED';
                    if (s.roadmap[2].status === 'PENDING') {
                        s.roadmap[2].status = 'IN_PROGRESS';
                    }
                } else if (student.status === 'COMPLETED') {
                    s.requirements.verifiedBy = currentUser.value.name;
                    s.requirements.dateVerified = new Date().toLocaleDateString();
                    s.roadmap[1].status = 'COMPLETED';
                    if (s.roadmap[2].status === 'PENDING') {
                        s.roadmap[2].status = 'IN_PROGRESS';
                    }
                } else if (student.status === 'DISCREPANCY') {
                    s.roadmap[1].status = 'FLAGGED';
                } else {
                    s.roadmap[1].status = 'IN_PROGRESS';
                }
            });
            loadQueue();
        };

        const markVerified = () => {
            if (selectedStudent.value) {
                selectedStudent.value.status = 'VERIFIED';
                persistStudentUpdate(selectedStudent.value);
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationModal'));
            modal.hide();
        };

        const markCompleted = () => {
            if (selectedStudent.value) {
                selectedStudent.value.status = 'COMPLETED';
                persistStudentUpdate(selectedStudent.value);
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationModal'));
            modal.hide();
        };

        const flagDiscrepancy = () => {
            if (selectedStudent.value) {
                selectedStudent.value.status = 'DISCREPANCY';
                persistStudentUpdate(selectedStudent.value);
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationModal'));
            modal.hide();
        };

        const rejectStudent = () => {
            if (selectedStudent.value) {
                selectedStudent.value.status = 'REJECTED';
                StationDataBus.updateStudent(selectedStudent.value.referenceNumber, (s) => {
                    s.requirements.status = 'REJECTED';
                    s.roadmap[1].status = 'FLAGGED';
                });
                loadQueue();
            }
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationModal'));
            modal.hide();
        };

        const verifyAll = () => {
            if (selectedStudent.value && selectedStudent.value.docs) {
                selectedStudent.value.docs.psa = 'verified';
                selectedStudent.value.docs.reportCard = 'verified';
                selectedStudent.value.docs.goodMoral = 'verified';
            }
        };

        const openNextPending = () => {
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'PENDING') {
                    openReview(students.value[i]);
                    break;
                }
            }
        };

        const flagDiscrepancyShortcut = () => {
            for (let i = 0; i < students.value.length; i++) {
                const student = students.value[i];
                if (student.status === 'PENDING') {
                    openReview(student);
                    student.status = 'DISCREPANCY';
                    persistStudentUpdate(student);
                    break;
                }
            }
        };

        const getReportCardLabel = (student) => {
            if (!student) return 'SHS Report Card';
            const track = student.shsTrack || '';
            const shs = student.seniorHighSchool || '';
            if (track === 'ALS' || shs.indexOf('ALS') !== -1 || shs.indexOf('Alternative Learning') !== -1) {
                return 'ALS Certificate of Rating';
            }
            if (track === 'OLD_CURRICULUM' || shs.indexOf('Old Curriculum') !== -1) {
                return 'High School Report Card (Old)';
            }
            return 'SHS Report Card';
        };

        const getReportCardSub = (student) => {
            if (!student) return 'Original Grade 12 report card';
            const track = student.shsTrack || '';
            const shs = student.seniorHighSchool || '';
            if (track === 'ALS' || shs.indexOf('ALS') !== -1 || shs.indexOf('Alternative Learning') !== -1) {
                return 'ALS A&E Test passing grades certificate';
            }
            if (track === 'OLD_CURRICULUM' || shs.indexOf('Old Curriculum') !== -1) {
                return 'Form 138-A from 4-year High School';
            }
            return 'Original Grade 12 report card';
        };

        const getGoodMoralLabel = (student) => {
            if (!student) return 'Good Moral Certificate';
            const track = student.shsTrack || '';
            const shs = student.seniorHighSchool || '';
            if (track === 'ALS' || shs.indexOf('ALS') !== -1 || shs.indexOf('Alternative Learning') !== -1) {
                return 'ALS Certificate of Completion';
            }
            return 'Good Moral Certificate';
        };

        const getGoodMoralSub = (student) => {
            if (!student) return 'Issued by previous school';
            const track = student.shsTrack || '';
            const shs = student.seniorHighSchool || '';
            if (track === 'ALS' || shs.indexOf('ALS') !== -1 || shs.indexOf('Alternative Learning') !== -1) {
                return 'Official certificate of ALS completion';
            }
            return 'Issued by previous school';
        };

        const currentTitle = computed(() => {
            if (currentView.value === 'dashboard') return 'Dashboard';
            if (currentView.value === 'queue') return 'Student Queue';
            if (currentView.value === 'logout') return 'Logout';
            return '';
        });

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
            currentView,
            searchQuery,
            activeFilter,
            sortBy,
            sortDesc,
            setFilter,
            toggleSort,
            getSortIcon,
            selectedStudent,
            students,
            filteredStudents,
            pendingCount,
            verifiedToday,
            discrepancyCount,
            completedCount,
            totalInQueue,
            verifiedDocsCount,
            currentDateTime,
            currentTitle,
            statusClass,
            badgeLabel,
            documentSubmissionCount,
            setView,
            getReportCardLabel,
            getReportCardSub,
            getGoodMoralLabel,
            getGoodMoralSub,
            openReview(student) {
                selectedStudent.value = student;
                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificationModal'));
                modal.show();
            },
            markVerified,
            markCompleted,
            flagDiscrepancy,
            rejectStudent,
            verifyAll,
            openNextPending,
            flagDiscrepancyShortcut,
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
