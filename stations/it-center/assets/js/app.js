(() => {
    const createApp = Vue.createApp;
    const ref = Vue.ref;
    const reactive = Vue.reactive;
    const computed = Vue.computed;
    const onMounted = Vue.onMounted;

    const App = {
        components: {
            'station-sidebar': window.StationSidebar
        },
        setup() {
            const currentView = ref('dashboard');
            const searchQuery = ref('');
            const activeFilter = ref('All');
            const sortBy = ref('referenceNumber');
            const sortDesc = ref(false);
            const selectedStudent = ref(null);
            const studentsList = ref([]);

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

            // Existing student accounts view state
            const accountsList = ref([]);
            const filterAccountProgram = ref('');
            const filterAccountYear = ref('');
            const filterAccountStatus = ref('');

            // Review / Enrollment Form State
            const generatedStudentId = ref('');
            const generatedEmail = ref('');
            const generatedPassword = ref('');
            const photoUploaded = ref(false);
            const photoFileName = ref('');
            const useRealCamera = ref(false);
            const capturedPhotoDataUrl = ref('');
            const mediaStream = ref(null);
            const isFinalizingEnrollment = ref(false);
            const savedPhotoWebPath = ref('');
            const selectedSections = ref({});
            const showCOR = ref(false);
            const corDetails = ref(null);

            // Dashboard stats (from backend aggregate)
            const dashboardStats = ref({
                pendingActivation: 0,
                activatedToday: 0,
                readyForIt: 0
            });

            // Toast notification state
            const toast = reactive({ show: false, message: '', type: 'success' });
            let toastTimer = null;
            const showToast = (message, type = 'success') => {
                clearTimeout(toastTimer);
                toast.message = message;
                toast.type    = type;
                toast.show    = true;
                toastTimer = setTimeout(() => { toast.show = false; }, 3800);
            };

            // Authentication State
            const currentUser = ref(null);
            const isLoggingIn = ref(false);
            const loginError = ref('');
            const loginForm = reactive({
                username: '',
                password: ''
            });

            // Date & Time
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

            const loadQueue = () => {
                const queue = StationDataBus.getQueue();
                const result = [];
                for (let i = 0; i < queue.length; i++) {
                    const student = queue[i];
                    // Only show students who have reached/completed the IT Center step
                    const step = student.roadmap ? student.roadmap.find(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : null;
                    if (!step || step.status === 'PENDING') {
                        continue;
                    }
                    result.push(student);
                }
                studentsList.value = result;
                fetchDashboardStats();
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
                    if (user.role === 'IT_CENTER' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'REGISTRAR') {
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



            // Fetch live stats from backend for dashboard counters
            const fetchDashboardStats = () => {
                fetch('../backend/api.php?action=get_enrollment_stats')
                    .then(res => res.json())
                    .then(result => {
                        if (result.success && result.data) {
                            dashboardStats.value = result.data;
                        }
                    })
                    .catch(() => { /* silently ignore — stats are non-critical */ });
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

            // Metrics
            const totalInQueue = computed(() => {
                let count = 0;
                for (let i = 0; i < studentsList.value.length; i++) {
                    const step = studentsList.value[i].roadmap ? studentsList.value[i].roadmap.find(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : null;
                    if (step && step.status !== 'COMPLETED') {
                        count++;
                    }
                }
                return count;
            });

            const completedToday = computed(() => {
                let count = 0;
                for (let i = 0; i < studentsList.value.length; i++) {
                    const step = studentsList.value[i].roadmap ? studentsList.value[i].roadmap.find(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : null;
                    if (step && step.status === 'COMPLETED') {
                        count++;
                    }
                }
                return count;
            });

            const filteredStudents = computed(() => {
                const query = searchQuery.value.trim().toLowerCase();
                const list = [];
                for (let i = 0; i < studentsList.value.length; i++) {
                    const s = studentsList.value[i];
                    const step = s.roadmap ? s.roadmap.find(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : null;
                    
                    let matchesQuery = true;
                    if (query) {
                        matchesQuery = s.name.toLowerCase().includes(query) || s.referenceNumber.toLowerCase().includes(query);
                    }

                    let matchesFilter = false;
                    if (activeFilter.value === 'All') {
                        matchesFilter = true;
                    } else if (activeFilter.value === 'Pending' && step && step.status !== 'COMPLETED') {
                        matchesFilter = true;
                    } else if (activeFilter.value === 'Completed' && step && step.status === 'COMPLETED') {
                        matchesFilter = true;
                    }

                    if (matchesQuery && matchesFilter) {
                        list.push(s);
                    }
                }

                // Registrar Sorting Logic
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

            const loadAccounts = () => {
                fetch('../backend/api.php?action=fetch_student_accounts')
                    .then(res => res.json())
                    .then(result => {
                        if (result.success && result.data) {
                            accountsList.value = result.data;
                        }
                    })
                    .catch(err => {
                        console.error('Failed to load student accounts:', err);
                    });
            };

            const filteredAccounts = computed(() => {
                const query = searchQuery.value.trim().toLowerCase();
                let list = accountsList.value || [];

                // Text Search Filter
                if (query) {
                    list = list.filter(acc => 
                        (acc.id && acc.id.toLowerCase().includes(query)) ||
                        (acc.name && acc.name.toLowerCase().includes(query)) ||
                        (acc.email && acc.email.toLowerCase().includes(query)) ||
                        (acc.program && acc.program.toLowerCase().includes(query))
                    );
                }

                // Program Filter
                if (filterAccountProgram.value) {
                    list = list.filter(acc => acc.program === filterAccountProgram.value);
                }

                // Year Level Filter
                if (filterAccountYear.value) {
                    list = list.filter(acc => acc.yearLevel === filterAccountYear.value || acc.year_level === filterAccountYear.value);
                }

                // Status Filter
                if (filterAccountStatus.value) {
                    list = list.filter(acc => acc.status === filterAccountStatus.value);
                }

                return list;
            });

            const uniqueAccountPrograms = computed(() => {
                return [...new Set(accountsList.value.map(acc => acc.program).filter(Boolean))].sort();
            });

            const setView = (view) => {
                currentView.value = view;
                searchQuery.value = '';
                if (view === 'accounts') {
                    loadAccounts();
                }
            };

            const openReview = (student) => {
                selectedStudent.value = student;
                photoUploaded.value = false;
                photoFileName.value = '';
                capturedPhotoDataUrl.value = '';
                useRealCamera.value = false;

                // Initialize section selectors
                selectedSections.value = {};
                const subjects = student.prospectusSubjects || [];
                const sections = student.availableSections || [];
                subjects.forEach(sub => {
                    const matches = sections.filter(sec => sec.subject === sub.title);
                    if (matches.length > 0) {
                        selectedSections.value[sub.code] = matches[0].code;
                    }
                });

                // If already completed/enrolled, load existing data
                if (student.enrollment && student.enrollment.permanentId) {
                    generatedStudentId.value = student.enrollment.permanentId;
                    generatedEmail.value = student.enrollment.institutionalEmail;
                    generatedPassword.value = student.enrollment.password;
                    photoUploaded.value = true;
                    photoFileName.value = student.enrollment.photoFile || 'id_portrait.jpg';
                    capturedPhotoDataUrl.value = student.enrollment.photoDataUrl || '';
                    if (student.enrollment.sections) {
                        selectedSections.value = { ...student.enrollment.sections };
                    }
                } else {
                    // Generate new credentials
                    const cleanFirst = student.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
                    const cleanLast = student.name.split(' ').pop().toLowerCase().replace(/[^a-z]/g, '');
                    const randomSuffix = Math.floor(10 + Math.random() * 90);
                    generatedEmail.value = `${cleanFirst}.${cleanLast}${randomSuffix}@gncp.edu.ph`;

                    // Load next sequential student ID from server
                    fetch('../backend/api.php?action=get_next_student_id')
                        .then(res => res.json())
                        .then(res => {
                            if (res.success && res.data) {
                                generatedStudentId.value = res.data.nextStudentId;
                            } else {
                                throw new Error('Failed to generate secure Student ID.');
                            }
                        })
                        .catch(() => {
                            showToast('Server failed to generate a secure Student ID. Please try again.', 'error');
                            const modal = bootstrap.Modal.getInstance(document.getElementById('itReviewModal'));
                            if (modal) modal.hide();
                        });

                    const nameParts = (student.name || '').trim().split(' ');
                    const rawLast = student.lastName || nameParts[nameParts.length - 1] || 'delacruz';
                    const cleanPasswordLast = rawLast.toLowerCase().replace(/[^a-z0-9]/g, '');
                    generatedPassword.value = cleanPasswordLast || 'delacruz';
                }

                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('itReviewModal'));
                modal.show();
            };

            const finalizeEnrollment = async () => {
                if (!selectedStudent.value) return;
                if (getItStepStatus(selectedStudent.value) === 'COMPLETED') return;
                if (isFinalizingEnrollment.value) return;

                isFinalizingEnrollment.value = true;

                try {
                    const student = selectedStudent.value;
                    const enrollmentData = {
                        permanentId:        generatedStudentId.value,
                        institutionalEmail: generatedEmail.value,
                        password:           generatedPassword.value,
                        photoFile:          photoFileName.value || null,
                        photoWebPath:       savedPhotoWebPath.value || null,
                        photoDataUrl:       capturedPhotoDataUrl.value || null,
                        activatedBy:        currentUser.value?.name || 'IT Officer',
                        dateActivated:      new Date().toLocaleDateString('en-PH', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        }),
                        sections:           { ...selectedSections.value }
                    };

                    const updatePayload = JSON.parse(JSON.stringify(student));
                    updatePayload.enrollment = enrollmentData;
                    updatePayload.status = 'ENROLLED';
                    const itStepIdx = (updatePayload.roadmap && Array.isArray(updatePayload.roadmap)) ? updatePayload.roadmap.findIndex(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : -1;
                    if (itStepIdx !== -1) {
                        updatePayload.roadmap[itStepIdx].status = 'COMPLETED';
                        updatePayload.roadmap[itStepIdx].updatedAt = new Date().toISOString();
                    }

                    const response = await fetch('../backend/api.php?action=update_student', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            referenceNumber: student.referenceNumber,
                            updateData: updatePayload
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Server rejected finalization request.');
                    }

                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.error || 'Server transaction failed.');
                    }

                    const promoCreds = result.data || {};
                    enrollmentData.permanentId = promoCreds.permanentId || enrollmentData.permanentId;
                    enrollmentData.institutionalEmail = promoCreds.institutionalEmail || enrollmentData.institutionalEmail;
                    enrollmentData.password = promoCreds.password || enrollmentData.password;

                    StationDataBus.updateStudent(student.referenceNumber, (s) => {
                        s.enrollment = enrollmentData;
                        s.status = 'ENROLLED';
                        const itStepIdx = (s.roadmap && Array.isArray(s.roadmap)) ? s.roadmap.findIndex(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final') : -1;
                        if (itStepIdx !== -1) {
                            s.roadmap[itStepIdx].status = 'COMPLETED';
                            s.roadmap[itStepIdx].updatedAt = new Date().toISOString();
                        }
                    }, ['enrollment', 'status', 'roadmap']); // Delta: only send enrollment + status + roadmap

                    corDetails.value = {
                        student: { ...student, enrollment: enrollmentData }
                    };

                    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('itReviewModal'));
                    modal.hide();

                    showToast(`Account activated for ${student.name}`, 'success');
                    showCOR.value = true;
                    loadQueue();

                } catch (err) {
                    console.error('[IT Center] Finalization error:', err);
                    showToast(err.message || 'An error occurred during activation. Please try again.', 'error');
                } finally {
                    isFinalizingEnrollment.value = false;
                }
            };

            const getItStepStatus = (student) => {
                if (!student || !student.roadmap) return 'PENDING';
                const step = student.roadmap.find(r => r.stepId === 'it_activation' || r.stepId === 'id_email_final');
                return step ? step.status : 'PENDING';
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

            const getSortedSectionsForSubject = (subTitle) => {
                if (!selectedStudent.value || !selectedStudent.value.availableSections) return [];
                return [...selectedStudent.value.availableSections]
                    .filter(x => x.subject === subTitle)
                    .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
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
                searchQuery,
                activeFilter,
                sortBy,
                sortDesc,
                setFilter,
                toggleSort,
                getSortIcon,
                studentsList,
                filteredStudents,
                totalInQueue,
                completedToday,
                selectedStudent,
                generatedStudentId,
                generatedEmail,
                generatedPassword,
                photoUploaded,
                photoFileName,
                useRealCamera,
                capturedPhotoDataUrl,
                isFinalizingEnrollment,
                selectedSections,
                showCOR,
                corDetails,
                dashboardStats,
                toast,
                setView,
                openReview,
                finalizeEnrollment,
                getStepIcon,
                getSortedSectionsForSubject,
                getItStepStatus,
                formatStatus,
                getStatusBadgeClass,
                currentUser,
                isLoggingIn,
                loginError,
                loginForm,
                handleLogout,
                showLogoutConfirm,
                confirmLogout,
                accountsList,
                filterAccountProgram,
                filterAccountYear,
                filterAccountStatus,
                filteredAccounts,
                uniqueAccountPrograms,
                loadAccounts,
                timeGreeting
            };
        }
    };

    createApp(App).mount('#app');
})();
