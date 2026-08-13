/**
 * GNCP Registrar Portal — RegistrarController Module
 *
 * Controller managing application state, client-side persistence, and mounting.
 */
(function (global) {
    const createApp = Vue.createApp;
    const ref = Vue.ref;
    const reactive = Vue.reactive;
    const computed = Vue.computed;
    const onMounted = Vue.onMounted;
    const onUnmounted = Vue.onUnmounted;
    const watch = Vue.watch;

    const Model = global.RegistrarModel;
    const View = global.RegistrarView;

    const App = {
        setup() {
            // ── Auth State ────────────────────────────────────────────────
            const currentUser = ref(null);
            const isLoggingIn = ref(false);
            const loginError = ref('');
            const loginForm = reactive({ username: '', password: '' });

            const timeGreeting = computed(() => {
                const hour = new Date().getHours();
                if (hour < 12) return 'Great Morning';
                if (hour < 18) return 'Great Afternoon';
                return 'Great Evening';
            });

            let pollTimer = null;

            const startLiveSync = () => {
                if (pollTimer) clearInterval(pollTimer);
                pollTimer = setInterval(() => {
                    if (currentUser.value) {
                        loadData();
                    }
                }, 4000);
            };

            const stopLiveSync = () => {
                if (pollTimer) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            };

            // ── View State ────────────────────────────────────────────────
            const currentView = ref('pending-applications'); // Registrar: application review only
            const searchText = ref('');
            const courseSearch = ref('');
            const applicationSearch = ref('');
            const applicationFilter = ref('all');
            const selectedApplication = ref(null);
            const applicationModalMode = ref('review');
            const courseModalMode = ref('add');
            const requirementsError = ref('');
            const showRequirementsValidation = ref(false);
            const selectedStudent = ref(null);

            // ── Academic Catalog States ───────────────────────────────────
            const selectedProgram = ref(null);
            const programModalMode = ref('add');
            const selectedSubject = ref(null);
            const subjectModalMode = ref('add');
            const selectedCurriculum = ref(null);
            const curriculumModalMode = ref('add');
            const selectedPeriod = ref(null);
            const periodModalMode = ref('add');
            const selectedSection = ref(null);
            const sectionModalMode = ref('add');
            const selectedFee = ref(null);
            const feeModalMode = ref('add');

            // ── Logout Confirmation State ─────────────────────────────────
            const showLogoutConfirm = ref(false);


            // ── Data Repositories ─────────────────────────────────────────
            const navItems = ref(Model.getNavItems());
            const staticMeta = Model.getStaticMeta();

            const programs = ref([]);
            const subjects = ref([]);
            const curriculum = ref([]);
            const academicPeriods = ref([]);
            const subjectSections = ref([]);
            const feeSchedule = ref([]);
            const students = ref([]);
            const enrollments = ref([]);
            const pendingApplications = ref([]);
            const sections = ref([]);

            const reports = computed(() => {
                const totalProg = programs.value.length;
                const totalSubs = subjects.value.length;
                const totalSecs = subjectSections.value.length;
                const totalStud = students.value.length;
                const pendingCount = pendingApplications.value.filter(s => s.status !== 'ENROLLED').length;

                return [
                    { title: 'Registered Students', value: totalStud.toString(), meta: 'Approved and promoted' },
                    { title: 'Subject Catalog', value: totalSubs.toString(), meta: `Spread across ${totalProg} programs` },
                    { title: 'Class Sections Scheduled', value: totalSecs.toString(), meta: 'With active class capacities' },
                    { title: 'Pending Review Queue', value: pendingCount.toString(), meta: 'Applicants awaiting verification' }
                ];
            });

            const loadData = () => {
                Model.loadInitialData()
                    .then(data => {
                        programs.value = data.programs || [];
                        subjects.value = data.subjects || [];
                        curriculum.value = data.curriculum || [];
                        academicPeriods.value = data.academicPeriods || [];
                        subjectSections.value = data.subjectSections || [];
                        feeSchedule.value = data.feeSchedule || [];
                        students.value = data.students || [];
                        enrollments.value = data.enrollments || [];
                        pendingApplications.value = data.pendingApplications || [];
                        sections.value = data.sections || [];
                    })
                    .catch(err => {
                        console.error('Error loading registrar data:', err);
                    });
            };

            // ── Auth & Live Profile Handling ─────────────────────────────
            const checkSession = async () => {
                const stored = sessionStorage.getItem('gncp_station_user') 
                            || sessionStorage.getItem('gncp_admin_user')
                            || localStorage.getItem('gncp_station_user')
                            || localStorage.getItem('gncp_admin_user');
                if (!stored) {
                    currentUser.value = null;
                    return;
                }

                let user = null;
                try {
                    user = JSON.parse(stored);
                } catch (e) {
                    currentUser.value = null;
                    return;
                }

                const allowedRoles = ['REGISTRAR', 'SUPER_ADMIN', 'ADMIN'];
                if (!user || !user.role || !allowedRoles.includes(user.role)) {
                    currentUser.value = null;
                    return;
                }

                currentUser.value = user;

                // Sync live user profile from backend (Avatar, Name, Email)
                try {
                    const profRes = await RegistrarApiService.fetchUserProfile(user.username);
                    if (profRes && profRes.success && profRes.data) {
                        const updatedUser = {
                            ...user,
                            name: profRes.data.name || user.name,
                            email: profRes.data.email || user.email,
                            avatar: profRes.data.avatar || user.avatar
                        };
                        currentUser.value = updatedUser;
                        const sessionKey = (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                        sessionStorage.setItem(sessionKey, JSON.stringify(updatedUser));
                    }
                } catch (err) {
                    console.warn('Profile sync warning:', err);
                }

                // Password change guard check
                if (user.must_change_password && typeof global.PasswordChangeGuard !== 'undefined') {
                    global.PasswordChangeGuard.checkAndPrompt(user, function () {
                        const updatedUser = { ...currentUser.value, must_change_password: false };
                        currentUser.value = updatedUser;
                        const sessionKey = (updatedUser.role === 'SUPER_ADMIN' || updatedUser.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                        sessionStorage.setItem(sessionKey, JSON.stringify(updatedUser));
                        loadData();
                        startLiveSync();
                    });
                } else {
                    loadData();
                    startLiveSync();
                }
            };


            const handleLogout = () => {
                showLogoutConfirm.value = true;
            };

            const confirmLogout = () => {
                showLogoutConfirm.value = false;
                stopLiveSync();
                currentUser.value = null;
                sessionStorage.removeItem('gncp_station_user');
                sessionStorage.removeItem('gncp_admin_user');
                localStorage.removeItem('gncp_station_user');
                localStorage.removeItem('gncp_admin_user');

                fetch('../api/index.php?action=auth/logout', { method: 'POST' })
                    .catch(() => {})
                    .finally(() => {
                        window.location.href = '../index.html?clear=true';
                    });
            };

            onMounted(() => {
                checkSession();
            });

            onUnmounted(() => {
                stopLiveSync();
            });

            // ── Computed Properties ───────────────────────────────────────
            const isAdmin = computed(() => {
                return currentUser.value && (currentUser.value.role === 'SUPER_ADMIN' || currentUser.value.role === 'ADMIN');
            });

            const topBarEyebrow = computed(() => {
                const view = currentView.value;
                const catalogViews = ['programs', 'subjects', 'curriculum', 'academic-periods', 'subject-sections', 'fee-schedule'];
                if (catalogViews.includes(view)) return 'Academic Catalog';
                return 'Records & Overview';
            });

            const topBarTitle = computed(() => {
                const view = currentView.value;
                if (view === 'pending-applications') return 'Pending Applications';
                if (view === 'students') return 'Students';
                if (view === 'enrollment-overview') return 'Enrollment Overview';
                if (view === 'reports') return 'Reports';
                if (view === 'programs') return 'Programs Catalog';
                if (view === 'subjects') return 'Subjects Catalog';
                if (view === 'curriculum') return 'Curriculum Mapping';
                if (view === 'academic-periods') return 'Academic Periods';
                if (view === 'subject-sections') return 'Subject Sections';
                if (view === 'fee-schedule') return 'Fee Schedule';
                return 'Dashboard';
            });

            const searchPlaceholder = computed(() => {
                const view = currentView.value;
                if (view === 'programs') return 'Search programs by code or name...';
                if (view === 'subjects') return 'Search subjects by code or title...';
                if (view === 'curriculum') return 'Search program curriculum mappings...';
                if (view === 'academic-periods') return 'Search academic periods...';
                if (view === 'subject-sections') return 'Search class schedules/instructors...';
                if (view === 'fee-schedule') return 'Search configured fees...';
                if (view === 'pending-applications') return 'Search pending applications...';
                if (view === 'students') return 'Search student records...';
                return 'Search academic data...';
            });

            // ── Helper Modal Controls ─────────────────────────────────────
            const getModalInstance = (id) => {
                const element = document.getElementById(id);
                return element ? bootstrap.Modal.getOrCreateInstance(element) : null;
            };

            const hideModal = (id) => {
                const modal = getModalInstance(id);
                if (modal) modal.hide();
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                document.body.setAttribute('tabindex', '-1');
                document.body.focus();
            };

            const setView = (view) => {
                if (view === 'logout') {
                    handleLogout();
                    return;
                }
                searchText.value = '';
                // Close modals
                hideModal('programModal');
                hideModal('subjectModal');
                hideModal('curriculumModal');
                hideModal('periodModal');
                hideModal('sectionModal');
                hideModal('feeModal');
                currentView.value = view;
            };





            const availableSectionsForApplication = ref([]);

            const ensureRoadmapNormalized = (roadmap, status) => {
                if (!roadmap || !Array.isArray(roadmap) || roadmap.length === 0) {
                    return [
                        { stepId: 'online_registration', title: 'Online Pre-Enrollment Submission', station: 'Online Portal', location: 'Remote / Web', status: 'COMPLETED' },
                        { stepId: 'registrar_verification', title: 'Registrar Application Review', station: 'Station 1: Registrar', location: 'Admin Building G/F', status: ['APPROVED', 'Approved', 'REGISTRAR_APPROVED', 'VERIFIED'].includes(status) ? 'COMPLETED' : 'IN_PROGRESS' },
                        { stepId: 'advising_assessment', title: 'Academic Advising & Block Sectioning', station: 'Station 2: Academic Advising', location: 'College Department Hall', status: 'PENDING' },
                        { stepId: 'clinic_checkup', title: 'Medical Pre-Screening & Physical Exam', station: 'Station 3: School Clinic', location: 'Health Services Building', status: 'PENDING' },
                        { stepId: 'cashier_payment', title: 'Tuition Assessment & Cashier Payment', station: 'Station 4: Cashier', location: 'Finance Building 1st Flr', status: 'PENDING' },
                        { stepId: 'id_email_final', title: 'Student ID & Institutional Email Issuance', station: 'Station 5: IT Center', location: 'Computer Lab 2', status: 'PENDING' }
                    ];
                }
                return roadmap.map((item, idx) => ({
                    stepId: item.stepId || item.id || ('step_' + idx),
                    title: item.title || item.name || ('Step ' + (idx + 1)),
                    station: item.station || item.location || ('Station ' + (idx + 1)),
                    location: item.location || 'GNCP Campus',
                    status: item.status || 'PENDING'
                }));
            };

            const openApplicationModal = (application, mode = 'review') => {
                applicationModalMode.value = mode;
                selectedApplication.value = JSON.parse(JSON.stringify(application));
                if (selectedApplication.value && !selectedApplication.value.hasOwnProperty('sectionCode')) {
                    selectedApplication.value.sectionCode = null;
                }
                if (selectedApplication.value) {
                    selectedApplication.value.roadmap = ensureRoadmapNormalized(selectedApplication.value.roadmap, selectedApplication.value.status);
                }
                requirementsError.value = '';
                showRequirementsValidation.value = false;

                // Helper to ensure student's assigned section is in the list
                const ensureSelectedSectionInList = (list, sectionCode, program) => {
                    if (!sectionCode) return list;
                    const exists = list.some(s => s.code === sectionCode);
                    if (!exists) {
                        list.push({
                            id: 0,
                            code: sectionCode,
                            program: program || 'BSIT',
                            yearLevel: '1st Year',
                            sectionName: 'Section ' + sectionCode,
                            capacity: 40,
                            enrolledCount: 0,
                            availableSlots: 40,
                            occupancyPct: 0,
                            adviser: 'Unassigned',
                            curriculumVersion: '—',
                            semester: '1st Semester',
                            schoolYear: '—'
                        });
                    }
                    return list;
                };

                // Helper: filter sections from already-loaded data as fallback
                const getSectionsFromLoaded = (progCode, targetYearLevel) => {
                    if (!sections.value || !progCode) return [];
                    const search = progCode.trim().toLowerCase();

                    const progObj = programs.value ? programs.value.find(p => p.code.trim().toLowerCase() === search || p.name.trim().toLowerCase() === search) : null;
                    const searchName = progObj ? progObj.name.trim().toLowerCase() : search;
                    const searchCode = progObj ? progObj.code.trim().toLowerCase() : search;

                    const targetYear = (targetYearLevel || '1st Year').trim().toLowerCase();
                    return sections.value.filter(s => {
                        const progName = (s.program || '').trim().toLowerCase();
                        const isProgMatch = (progName === searchName ||
                            progName === searchCode ||
                            progName.includes(search) ||
                            search.includes(progName));

                        const sectionYear = (s.yearLevel || '1st Year').trim().toLowerCase();
                        const isYearMatch = !targetYear || sectionYear === targetYear || sectionYear.includes(targetYear) || targetYear.includes(sectionYear);
                        return isProgMatch && isYearMatch;
                    }).map(s => ({
                        id: s.id || 0,
                        code: s.code,
                        program: s.program,
                        yearLevel: s.yearLevel || '1st Year',
                        sectionName: s.program + ' — Section ' + s.code,
                        capacity: s.capacity || 40,
                        enrolledCount: 0,
                        availableSlots: s.capacity || 40,
                        occupancyPct: 0,
                        adviser: s.adviser || 'Unassigned',
                        curriculumVersion: '—',
                        semester: '1st Semester',
                        schoolYear: '—'
                    }));
                };

                // Pre-populate from loaded sections immediately (no wait)
                const fallbackList = getSectionsFromLoaded(application.program, application.yearLevel);
                availableSectionsForApplication.value = ensureSelectedSectionInList(fallbackList, application.sectionCode, application.program);

                // Then try to get fresh data from API (with live enrolled counts)
                if (application.program) {
                    const yLevel = application.yearLevel || '1st Year';
                    Model.getSectionsForProgram(application.program, yLevel, '1st Semester')
                        .then(res => {
                            if (res.success && res.data && res.data.length > 0) {
                                availableSectionsForApplication.value = ensureSelectedSectionInList(res.data, application.sectionCode, application.program);
                            } else if (application.sectionCode) {
                                availableSectionsForApplication.value = ensureSelectedSectionInList([], application.sectionCode, application.program);
                            }
                        })
                        .catch(err => {
                            console.error('Failed to load sections for program modal:', err);
                            // Keep the pre-populated fallback data
                        });
                }

                getModalInstance('applicationModal')?.show();
            };


            const printForm = (app) => {
                if (!app) return;
                const url = `../stations/payment-processing/cor_print.php?ref=${app.referenceNumber}&pin=${app.tempPin}`;
                window.open(url, '_blank');
            };

            const openStudentModal = (student) => {
                selectedStudent.value = JSON.parse(JSON.stringify(student));
                if (selectedStudent.value) {
                    selectedStudent.value.roadmap = ensureRoadmapNormalized(selectedStudent.value.roadmap, selectedStudent.value.status);
                }
                getModalInstance('studentProfileModal')?.show();
            };

            const getDocKey = (item) => {
                if (!item) return 'other';
                const text = item.toLowerCase().trim();
                // Legacy key mappings to preserve backward compatibility for standard freshman documents
                if (text.startsWith('form 138') || (text.includes('report card') && !text.includes('old high school'))) return 'reportCard';
                if (text.startsWith('psa birth certificate')) return 'psa';
                if (text.startsWith('original certificate of good moral')) return 'goodMoral';

                // Unique key per distinct requirement title to eliminate key collision bugs
                return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            };

            const activePreviewDoc = ref(null);

            const getDocFile = (item, studentRecord = null) => {
                const appRecord = studentRecord || selectedApplication.value;
                if (!appRecord || !appRecord.requirementsData || !appRecord.requirementsData.files) return null;
                const key = getDocKey(item);
                return appRecord.requirementsData.files[key] || null;
            };

            const openDocumentModal = (fileObj) => {
                activePreviewDoc.value = fileObj;
            };

            const isImageFile = (pathOrName) => {
                if (!pathOrName) return false;
                const ext = pathOrName.split('.').pop().toLowerCase();
                return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
            };

            const isPdfFile = (pathOrName) => {
                if (!pathOrName) return false;
                const ext = pathOrName.split('.').pop().toLowerCase();
                return ext === 'pdf';
            };

            const isDocVerified = (item) => {
                if (!selectedApplication.value || !selectedApplication.value.requirementsData) return false;
                const key = getDocKey(item);
                const docs = selectedApplication.value.requirementsData.docs || {};
                return docs[key] === 'verified' || docs[key] === 'submitted';
            };

            const toggleDocStatus = (item, checked) => {
                if (!selectedApplication.value) return;

                const currentStatus = selectedApplication.value.status;
                const isApproved = ['Approved', 'APPROVED', 'REGISTRAR_APPROVED'].includes(currentStatus);

                if (['ENROLLED', 'Rejected', 'REJECTED'].includes(currentStatus)) {
                    return;
                }

                if (!selectedApplication.value.requirementsData) {
                    selectedApplication.value.requirementsData = {
                        status: 'PENDING',
                        docs: { psa: 'not-submitted', reportCard: 'not-submitted', goodMoral: 'not-submitted' }
                    };
                }
                if (!selectedApplication.value.requirementsData.docs) {
                    selectedApplication.value.requirementsData.docs = {};
                }

                const key = getDocKey(item);

                if (isApproved && !checked) {
                    Swal.fire({
                        title: 'Action Blocked',
                        text: 'Verified admission requirements cannot be unchecked once an application has been approved.',
                        icon: 'error',
                        confirmButtonColor: '#006A4E',
                        confirmButtonText: 'OK'
                    });
                    if (selectedApplication.value.requirementsData && selectedApplication.value.requirementsData.docs) {
                        selectedApplication.value.requirementsData.docs[key] = 'verified';
                    }
                    return;
                }

                selectedApplication.value.requirementsData.docs[key] = checked ? 'verified' : 'not-submitted';

                if (isApproved) {
                    // Immediately save the requirements change
                    const refNum = selectedApplication.value.referenceNumber;
                    const notes = selectedApplication.value.registrarNotes || '';
                    const reqData = selectedApplication.value.requirementsData;
                    const sectionCode = selectedApplication.value.sectionCode;
                    Model.updateApplicationStatus(refNum, currentStatus, notes, reqData, sectionCode).then(res => {
                        if (res.success) {
                            const index = pendingApplications.value.findIndex(a => a.referenceNumber === refNum);
                            if (index !== -1) {
                                pendingApplications.value[index] = res.data;
                            }
                            loadData();
                        }
                    });
                } else {
                    // Dynamic recovery check: if validator is visible, auto-clear warning once all checked
                    if (showRequirementsValidation.value) {
                        const reqs = selectedApplication.value.requirements || [];
                        const allChecked = reqs.every(r => isDocVerified(r));
                        if (allChecked) {
                            showRequirementsValidation.value = false;
                            requirementsError.value = '';
                        }
                    }
                }
            };

            const updateApplicationStatus = async (status) => {
                if (!selectedApplication.value) return;

                const currentStatus = selectedApplication.value.status;
                if (['APPROVED', 'Approved', 'REGISTRAR_APPROVED'].includes(currentStatus)) {
                    await Swal.fire({
                        title: 'Error',
                        text: 'This application has already been approved.',
                        icon: 'error',
                        confirmButtonColor: '#198754'
                    });
                    return;
                }

                if (['Rejected', 'REJECTED'].includes(currentStatus)) {
                    await Swal.fire({
                        title: 'Error',
                        text: 'This application has already been permanently rejected and cannot be modified.',
                        icon: 'error',
                        confirmButtonColor: '#dc3545'
                    });
                    return;
                }

                if (status === 'Approved' && !selectedApplication.value.sectionCode) {
                    await Swal.fire({
                        title: 'Section Required',
                        text: 'Please assign a block section for this student before approving.',
                        icon: 'warning',
                        confirmButtonColor: '#198754'
                    });
                    return;
                }

                const refNum = selectedApplication.value.referenceNumber;

                // Build confirmation messages, with a hard block when docs aren't all verified
                const reqs = selectedApplication.value.requirements || [];
                const unverifiedCount = reqs.filter(item => !isDocVerified(item)).length;

                // Show validation feedback in the form and hard-block approval
                if (status === 'Approved' && unverifiedCount > 0) {
                    showRequirementsValidation.value = true;
                    requirementsError.value = `${unverifiedCount} document(s) not yet checked. All required documents must be verified before approval.`;
                    await Swal.fire({
                        title: 'Requirements Incomplete',
                        text: `This application cannot be approved because ${unverifiedCount} required document(s) are not yet verified.`,
                        icon: 'error',
                        confirmButtonColor: '#dc3545'
                    });
                    return;
                } else {
                    showRequirementsValidation.value = false;
                    requirementsError.value = '';
                }

                const labels = {
                    'Approved': `Approve application ${refNum}? This will mark the applicant as approved and advance their enrollment roadmap.`,
                    'Rejected': `Reject application ${refNum}? This action is permanent and cannot be undone. The applicant must submit a completely new pre-registration application if they wish to apply again.`,
                    'Pending': `Send application ${refNum} back for correction? The student will be asked to resubmit or update information.`
                };
                const msg = labels[status] || 'Are you sure?';

                const confirmRes = await Swal.fire({
                    title: 'Confirm Action',
                    html: msg.replace(/\n/g, '<br>'),
                    icon: status === 'Rejected' ? 'error' : status === 'Approved' ? 'question' : 'warning',
                    showCancelButton: true,
                    confirmButtonColor: status === 'Rejected' ? '#dc3545' : '#198754',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, proceed'
                });
                if (!confirmRes.isConfirmed) return;

                const notes = "";
                const reqData = selectedApplication.value.requirementsData;
                const sectionCode = selectedApplication.value.sectionCode;
                Model.updateApplicationStatus(refNum, status, notes, reqData, sectionCode).then(res => {
                    if (res.success) {
                        const index = pendingApplications.value.findIndex(a => a.referenceNumber === refNum);
                        if (index !== -1) {
                            pendingApplications.value[index] = res.data;
                        }
                        hideModal('applicationModal');
                        loadData();
                    }
                });
            };

            // ── Academic Catalog CRUD Methods ─────────────────────────────
            const openProgramModal = (mode, program = null) => {
                programModalMode.value = mode;
                selectedProgram.value = program ? JSON.parse(JSON.stringify(program)) : { code: '', name: '', department: '', status: 'Active' };
                getModalInstance('programModal')?.show();
            };
            const saveProgram = (prog) => {
                Model.saveProgram(prog).then(res => {
                    if (res.success) {
                        programs.value = res.data || [];
                        hideModal('programModal');
                        loadData();
                    }
                });
            };
            const deleteProgram = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this program?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteProgram(id).then(res => {
                    if (res.success) {
                        programs.value = res.data || [];
                        loadData();
                    }
                });
            };

            const openSubjectModal = (mode, subject = null) => {
                subjectModalMode.value = mode;
                selectedSubject.value = subject ? JSON.parse(JSON.stringify(subject)) : { code: '', title: '', description: '', lectureUnits: 3, labUnits: 0, labFee: 0, department: '', prerequisites: 'None' };
                getModalInstance('subjectModal')?.show();
            };
            const saveSubject = (sub) => {
                Model.saveSubject(sub).then(res => {
                    if (res.success) {
                        subjects.value = res.data || [];
                        hideModal('subjectModal');
                        loadData();
                    }
                });
            };
            const deleteSubject = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this subject?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteSubject(id).then(res => {
                    if (res.success) {
                        subjects.value = res.data || [];
                        loadData();
                    }
                });
            };

            const openCurriculumModal = (mode, curr = null) => {
                curriculumModalMode.value = mode;
                selectedCurriculum.value = curr ? JSON.parse(JSON.stringify(curr)) : { program: '', subject: '', yearLevel: '1st Year', semester: '1st Semester', elective: false };
                getModalInstance('curriculumModal')?.show();
            };
            const saveCurriculum = (curr) => {
                Model.saveCurriculum(curr).then(res => {
                    if (res.success) {
                        curriculum.value = res.data || [];
                        hideModal('curriculumModal');
                        loadData();
                    }
                });
            };
            const deleteCurriculum = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this curriculum mapping?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteCurriculum(id).then(res => {
                    if (res.success) {
                        curriculum.value = res.data || [];
                        loadData();
                    }
                });
            };

            const openPeriodModal = (mode, period = null) => {
                periodModalMode.value = mode;
                selectedPeriod.value = period ? JSON.parse(JSON.stringify(period)) : { name: '', academicYear: '', semester: '1st Semester', enrollmentStart: '', enrollmentEnd: '', status: 'Inactive' };
                getModalInstance('periodModal')?.show();
            };
            const saveAcademicPeriod = (period) => {
                Model.saveAcademicPeriod(period).then(res => {
                    if (res.success) {
                        academicPeriods.value = res.data || [];
                        hideModal('periodModal');
                        loadData();
                    }
                });
            };
            const deleteAcademicPeriod = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this academic period?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteAcademicPeriod(id).then(res => {
                    if (res.success) {
                        academicPeriods.value = res.data || [];
                        loadData();
                    }
                });
            };

            const openSectionModal = (mode, section = null) => {
                sectionModalMode.value = mode;
                selectedSection.value = section ? JSON.parse(JSON.stringify(section)) : { program: '', yearLevel: '1st Year', semester: '1st Semester', subject: '', code: '', instructor: '', days: '', time: '', room: '', capacity: 40 };
                getModalInstance('sectionModal')?.show();
            };
            const saveSubjectSection = (sect) => {
                Model.saveSubjectSection(sect).then(res => {
                    if (res.success) {
                        subjectSections.value = res.data || [];
                        hideModal('sectionModal');
                        loadData();
                    }
                });
            };
            const deleteSubjectSection = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this class section?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteSubjectSection(id).then(res => {
                    if (res.success) {
                        subjectSections.value = res.data || [];
                        loadData();
                    }
                });
            };

            const openFeeModal = (mode, fee = null) => {
                feeModalMode.value = mode;
                selectedFee.value = fee ? JSON.parse(JSON.stringify(fee)) : { type: 'Tuition', label: '', amount: 0, perUnit: false };
                getModalInstance('feeModal')?.show();
            };
            const saveFee = (fee) => {
                Model.saveFee(fee).then(res => {
                    if (res.success) {
                        feeSchedule.value = res.data || [];
                        hideModal('feeModal');
                        loadData();
                    }
                });
            };
            const deleteFee = async (id) => {
                const confirmRes = await Swal.fire({
                    title: 'Are you sure?',
                    text: 'Are you sure you want to delete this fee item?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc3545',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Yes, delete it!'
                });
                if (!confirmRes.isConfirmed) return;
                Model.deleteFee(id).then(res => {
                    if (res.success) {
                        feeSchedule.value = res.data || [];
                        loadData();
                    }
                });
            };

            const updateRoadmapStep = (refNum, stepId, status) => {
                Model.updateRoadmapStep(refNum, stepId, status).then(res => {
                    if (res.success) {
                        loadData();
                    }
                });
            };

            // ── Live Computeds (Overview KPIs) ────────────────────────────
            const pendingCount = computed(() => {
                return pendingApplications.value.filter(a => a.status === 'Pending').length;
            });

            const totalEnrolled = computed(() => {
                return students.value.filter(s => s.status === 'Active').length;
            });

            const newToday = computed(() => {
                return enrollments.value.filter(e => e.status === 'Enrolled').length;
            });

            return {
                currentUser,
                isLoggingIn,
                loginError,
                loginForm,
                handleLogout,


                currentView,
                searchText,

                navItems,
                reports,

                programs,
                subjects,
                curriculum,
                academicPeriods,
                subjectSections,
                feeSchedule,
                students,
                enrollments,
                pendingApplications,
                sections,

                topBarEyebrow,
                topBarTitle,
                searchPlaceholder,

                setView,

                pendingCount,
                totalEnrolled,
                newToday,
                openApplicationModal,
                printForm,
                updateApplicationStatus,
                updateRoadmapStep,
                getDocKey,
                isDocVerified,
                toggleDocStatus,
                requirementsError,
                showRequirementsValidation,
                selectedApplication,
                selectedStudent,
                openStudentModal,
                availableSectionsForApplication,
                isAdmin,

                // Logout confirmation
                showLogoutConfirm,
                handleLogout,
                confirmLogout,

                activePreviewDoc,
                getDocFile,
                openDocumentModal,
                isImageFile,
                isPdfFile,

                // Academic Catalog States & Methods
                selectedProgram,
                programModalMode,
                selectedSubject,
                subjectModalMode,
                selectedCurriculum,
                curriculumModalMode,
                selectedPeriod,
                periodModalMode,
                selectedSection,
                sectionModalMode,
                selectedFee,
                feeModalMode,

                openProgramModal,
                saveProgram,
                deleteProgram,
                openSubjectModal,
                saveSubject,
                deleteSubject,
                openCurriculumModal,
                saveCurriculum,
                deleteCurriculum,
                openPeriodModal,
                saveAcademicPeriod,
                deleteAcademicPeriod,
                openSectionModal,
                saveSubjectSection,
                deleteSubjectSection,
                openFeeModal,
                saveFee,
                deleteFee,
                timeGreeting
            };
        }
    };

    const app = createApp(App);

    // Component registration mapped to views
    if (typeof View !== 'undefined' && View) {
        if (View.SidebarNav) app.component('sidebar-nav', View.SidebarNav);
        if (View.TopBar) app.component('top-bar', View.TopBar);
        if (View.StudentsView) app.component('students-view', View.StudentsView);
        if (View.PendingApplicationsView) app.component('pending-applications-view', View.PendingApplicationsView);
        if (View.EnrollmentOverviewView) app.component('enrollment-overview-view', View.EnrollmentOverviewView);
        if (View.ReportsView) app.component('reports-view', View.ReportsView);
        if (View.ProgramsView) app.component('programs-view', View.ProgramsView);
        if (View.SubjectsView) app.component('subjects-view', View.SubjectsView);
        if (View.CurriculumView) app.component('curriculum-view', View.CurriculumView);
        if (View.AcademicPeriodsView) app.component('academic-periods-view', View.AcademicPeriodsView);
        if (View.SubjectSectionsView) app.component('subject-sections-view', View.SubjectSectionsView);
        if (View.FeeScheduleView) app.component('fee-schedule-view', View.FeeScheduleView);
    }

    app.mount('#app');
})(typeof window !== 'undefined' ? window : this);
