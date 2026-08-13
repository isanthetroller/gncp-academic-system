/**
 * GNCP Super Admin — Main Controller & Vue App Mounting
 */

const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;

createApp({
    components: {
        'admin-sidebar': window.AdminSidebar
    },
    setup() {
        const post = AdminModel.post;
        const get = AdminModel.get;

        // Auth
        const currentAdmin = ref(null);
        const isLoggingIn  = ref(false);
        const loginError   = ref('');
        const showOperatorPassword = ref(false);

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
                if (currentAdmin.value) {
                    loadAll(true);
                }
            }, 4000);
        };

        const stopLiveSync = () => {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        };
        const loginForm    = reactive({ username:'', password:'' });

        // View state
        const view    = ref('dashboard');
        const search  = ref('');
        const modal   = ref('');
        const form    = reactive({});

        // Operator Management State (Decoupled & Isolated)
        const operatorForm = reactive({ id: null, name: '', email: '', username: '', password: '', role: '' });
        const isOperatorModalOpen = ref(false);
        const isEditOperatorModalOpen = ref(false);
        const isSubmittingOperator = ref(false);

        // Students & Collapsible navigation
        const students = ref([]);
        const expandedCats = ref({ catalog: true, term: true, scheduling: true });
        const selectedDeptName = ref('');
        const filterStudentProgram = ref('');
        const filterStudentYear = ref('');
        const filterStudentStatus = ref('');
        const filterAccountProgram = ref('');
        const filterAccountYear = ref('');
        const filterAccountStatus = ref('');

        // Term Cloning State
        const cloneForm = reactive({
            fromPeriodId: '',
            newPeriodName: '',
            newAcademicYear: '',
            newSemester: '1st Semester',
            enrollmentStart: '',
            enrollmentEnd: '',
            cloneSections: true,
            cloneOfferings: true
        });

        // Bulk Sections State
        const bulkForm = reactive({
            program: '',
            curriculumVersion: '2022 Curriculum',
            yearLevel: '1st Year',
            academicPeriodId: '',
            capacity: 40,
            adviser: '',
            count: 3
        });

        // Sort & Filter state
        const sortKey = ref(''); // e.g. 'programs_code'
        const sortDir = ref(1);   // 1: asc, -1: desc
        const filterProgramDept = ref('');
        const filterProgramStatus = ref('');
        const filterSubjectDept = ref('');
        const filterSubjectLab = ref('');
        const filterCurrProgram = ref('');
        const filterCurrYear = ref('');
        const filterCurrSem = ref('');
        const filterPeriodSem = ref('');
        const filterPeriodStatus = ref('');
        const filterSectPeriod = ref('');
        const filterSectProgram = ref('');
        const filterSectYear = ref('');
        const filterSectSem = ref('');
        const filterSectDays = ref('');
        
        // Views & Collapsibles
        const currView = ref('table'); // table | grouped
        const sectView = ref('table'); // table | cards
        const collapsedGroups = ref([]);

        // Dashboard Stats State
        const dashboardStats = ref(null);
        const isLoadingStats = ref(false);

        // Notifications
        const successMsg = ref('');
        const errorMsg   = ref('');

        // Data
        const departments = ref([]);
        const programs    = ref([]);
        const subjects    = ref([]);
        const curriculum  = ref([]);
        const periods     = ref([]);
        const sections    = ref([]); // cohort sections
        const classOfferings = ref([]); // class offerings
        const fees        = ref([]);
        const users       = ref([]);
        const filterUserStatus = ref('ALL');

        // ── Computed labels ──
        const eyebrow = computed(() => {
            if (view.value === 'dashboard') return 'System Analytics';
            if (['departments_programs','subjects','curriculum'].includes(view.value)) return 'Subjects & Degree Courses';
            if (['periods','sections'].includes(view.value)) return 'School Terms & Sections';
            if (['classOfferings','students','fees'].includes(view.value)) return 'Schedules & Billing';
            if (view.value === 'student_accounts') return 'Student Management';
            return 'Staff Accounts';
        });
        const viewTitle = computed(() => ({
            dashboard:'Dashboard Overview',
            departments_programs:'Departments & Courses', subjects:'Master List of Subjects', curriculum:'Subjects per Semester',
            periods:'Enrollment Semesters', sections:'Class Sections', classOfferings:'Create Class Schedules',
            students:'Student Records', fees:'Tuition & Misc Fees',
            operators:'Staff Logins (Operators)',
            student_accounts:'Student Portal Accounts'
        }[view.value] || ''));
        const addLabel = computed(() => ({
            departments_programs:'Program', subjects:'Subject', curriculum:'Entry',
            periods:'Period', sections:'Section', classOfferings:'Class Offering', fees:'Fee', operators:'Operator'
        }[view.value] || ''));
        const searchPlaceholder = computed(() => `Search ${viewTitle.value.toLowerCase()}…`);

        // ── Unique lists & Stats ──
        const uniqueProgramDepts = computed(() => {
            return [...new Set(programs.value.map(p => p.department).filter(Boolean))].sort();
        });
        const uniqueSubjectDepts = computed(() => {
            return [...new Set(subjects.value.map(s => s.department).filter(Boolean))].sort();
        });
        const uniqueCurriculumVersions = computed(() => {
            let list = curriculum.value;
            if (form.program) {
                list = list.filter(c => c.program === form.program);
            }
            const versions = list.map(c => c.curriculumVersion).filter(Boolean);
            if (versions.length === 0) return ['2022 Curriculum'];
            return [...new Set(versions)].sort();
        });
        const uniqueCurriculumVersionsForBulk = computed(() => {
            if (!bulkForm.program) return ['2022 Curriculum'];
            const versions = curriculum.value
                .filter(c => c.program === bulkForm.program)
                .map(c => c.curriculumVersion)
                .filter(Boolean);
            if (versions.length === 0) return ['2022 Curriculum'];
            return [...new Set(versions)].sort();
        });
        const programStats = computed(() => {
            const stats = {};
            programs.value.forEach(p => {
                stats[p.name] = { subjects: 0, sections: 0 };
            });
            curriculum.value.forEach(c => {
                if (stats[c.program]) stats[c.program].subjects++;
            });
            sections.value.forEach(s => {
                if (stats[s.program]) stats[s.program].sections++;
            });
            return stats;
        });

        // ── Sorting helper ──
        const sortData = (data, prefix) => {
            if (!sortKey.value.startsWith(prefix + '_')) return data;
            const prop = sortKey.value.substring(prefix.length + 1);
            return [...data].sort((a, b) => {
                let va = a[prop];
                let vb = b[prop];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                if (va < vb) return -1 * sortDir.value;
                if (va > vb) return 1 * sortDir.value;
                return 0;
            });
        };

        const sortBy = (prefix, prop) => {
            const key = prefix + '_' + prop;
            if (sortKey.value === key) {
                sortDir.value = -sortDir.value;
            } else {
                sortKey.value = key;
                sortDir.value = 1;
            }
        };

        // ── Filtered lists ──
        const q = () => search.value.toLowerCase();
        
        const filteredDepartments = computed(() => {
            let res = departments.value.filter(d => !q() || (d.code+d.name).toLowerCase().includes(q()));
            return sortData(res, 'departments');
        });

        const filteredPrograms = computed(() => {
            let res = programs.value.filter(p => {
                const matchesSearch = !q() || (p.code+p.name+p.department).toLowerCase().includes(q());
                const matchesDept = !filterProgramDept.value || p.department === filterProgramDept.value;
                const matchesStatus = !filterProgramStatus.value || p.status === filterProgramStatus.value;
                return matchesSearch && matchesDept && matchesStatus;
            });
            return sortData(res, 'programs');
        });

        const filteredProgramsList = computed(() => {
            let res = programs.value;
            if (selectedDeptName.value) {
                res = res.filter(p => p.department === selectedDeptName.value);
            }
            return res.filter(p => {
                return !q() || (p.code+p.name+p.department).toLowerCase().includes(q());
            });
        });

        const filteredStudents = computed(() => {
            return students.value.filter(st => {
                const matchesSearch = !q() || (st.id + st.name + st.program + st.yearLevel + st.status).toLowerCase().includes(q());
                const matchesProg = !filterStudentProgram.value || st.program === filterStudentProgram.value;
                const matchesYear = !filterStudentYear.value || st.yearLevel === filterStudentYear.value;
                const matchesStatus = !filterStudentStatus.value || st.status === filterStudentStatus.value;
                return matchesSearch && matchesProg && matchesYear && matchesStatus;
            });
        });

        const filteredSubjects = computed(() => {
            let res = subjects.value.filter(s => {
                const matchesSearch = !q() || (s.code+s.title+s.department).toLowerCase().includes(q());
                const matchesDept = !filterSubjectDept.value || s.department === filterSubjectDept.value;
                const matchesLab = !filterSubjectLab.value || (filterSubjectLab.value === 'lab' ? s.labUnits > 0 : s.labUnits === 0);
                return matchesSearch && matchesDept && matchesLab;
            });
            return sortData(res, 'subjects');
        });

        const filteredCurriculum = computed(() => {
            let res = curriculum.value.filter(c => {
                const matchesSearch = !q() || (c.program+c.subject+c.yearLevel+c.semester).toLowerCase().includes(q());
                const matchesProg = !filterCurrProgram.value || c.program === filterCurrProgram.value;
                const matchesYear = !filterCurrYear.value || c.yearLevel === filterCurrYear.value;
                const matchesSem = !filterCurrSem.value || c.semester === filterCurrSem.value;
                return matchesSearch && matchesProg && matchesYear && matchesSem;
            });
            return sortData(res, 'curriculum');
        });

        const curriculumGrouped = computed(() => {
            const list = filteredCurriculum.value;
            const progs = [...new Set(list.map(c => c.program))].sort();
            return progs.map(progName => {
                const progEntries = list.filter(c => c.program === progName);
                const years = [...new Set(progEntries.map(c => c.yearLevel))].sort();
                const yearBlocks = years.map(yr => {
                    const yrEntries = progEntries.filter(c => c.yearLevel === yr);
                    const sems = [...new Set(yrEntries.map(c => c.semester))].sort();
                    const semBlocks = sems.map(sem => {
                        return {
                            semester: sem,
                            entries: yrEntries.filter(c => c.semester === sem)
                        };
                    });
                    return {
                        year: yr,
                        semesters: semBlocks
                    };
                });
                return {
                    program: progName,
                    years: yearBlocks,
                    entries: progEntries
                };
            });
        });

        const toggleCurrGroup = (progName) => {
            if (collapsedGroups.value.includes(progName)) {
                collapsedGroups.value = collapsedGroups.value.filter(g => g !== progName);
            } else {
                collapsedGroups.value.push(progName);
            }
        };

        const filteredPeriods = computed(() => {
            let res = periods.value.filter(p => {
                const matchesSearch = !q() || (p.name+p.academicYear).toLowerCase().includes(q());
                const matchesSem = !filterPeriodSem.value || p.semester === filterPeriodSem.value;
                const matchesStatus = !filterPeriodStatus.value || p.status === filterPeriodStatus.value;
                return matchesSearch && matchesSem && matchesStatus;
            });
            return sortData(res, 'periods');
        });

        const filteredSections = computed(() => {
            let res = sections.value.filter(s => {
                const matchesSearch = !q() || (s.code+s.program+s.yearLevel).toLowerCase().includes(q());
                const matchesProg = !filterSectProgram.value || s.program === filterSectProgram.value;
                const matchesYear = !filterSectYear.value || s.yearLevel === filterSectYear.value;
                const matchesPeriod = !filterSectPeriod.value || s.academicPeriodId === parseInt(filterSectPeriod.value);
                return matchesSearch && matchesProg && matchesYear && matchesPeriod;
            });
            return sortData(res, 'sections');
        });

        const filteredClassOfferings = computed(() => {
            let res = classOfferings.value.filter(s => {
                const matchesSearch = !q() || (s.code+s.subject+s.instructor+(s.program||'')+(s.yearLevel||'')+(s.semester||'')).toLowerCase().includes(q());
                const matchesProg = !filterSectProgram.value || s.program === filterSectProgram.value;
                const matchesYear = !filterSectYear.value || s.yearLevel === filterSectYear.value;
                const matchesSem = !filterSectSem.value || s.semester === filterSectSem.value;
                const matchesDays = !filterSectDays.value || s.days === filterSectDays.value;
                return matchesSearch && matchesProg && matchesYear && matchesSem && matchesDays;
            });
            return sortData(res, 'classOfferings');
        });

        const filteredFees       = computed(() => fees.value.filter(f       => !q() || (f.type+f.label).toLowerCase().includes(q())));
        const filteredUsers      = computed(() => {
            if (!Array.isArray(users.value)) return [];
            return users.value.filter(u => {
                if (!u) return false;
                const roleUpper = (u.role || '').toUpperCase();
                if (['ADMIN', 'SUPER_ADMIN'].includes(roleUpper)) return false;
                
                const userStatusUpper   = (u.status || 'ACTIVE').toUpperCase();
                const filterStatusUpper = (filterUserStatus.value || 'ALL').toUpperCase();
                return filterStatusUpper === 'ALL' || userStatusUpper === filterStatusUpper;
            });
        });
        const filteredAccounts   = computed(() => {
            let res = students.value.filter(acc => {
                const matchesSearch = !q() || (acc.id + acc.name + (acc.email||'') + acc.program + acc.yearLevel + acc.status).toLowerCase().includes(q());
                const matchesProg   = !filterAccountProgram.value || acc.program === filterAccountProgram.value;
                const matchesYear   = !filterAccountYear.value   || acc.yearLevel === filterAccountYear.value;
                const matchesStatus = !filterAccountStatus.value  || acc.status === filterAccountStatus.value;
                return matchesSearch && matchesProg && matchesYear && matchesStatus;
            });
            return sortData(res, 'accounts');
        });

        const filteredSubjectsForSection = computed(() => {
            if (!form.program || !form.yearLevel || !form.semester) {
                return subjects.value;
            }
            const matchingCurr = curriculum.value.filter(c => 
                c.program === form.program && 
                c.yearLevel === form.yearLevel && 
                c.semester === form.semester &&
                (!form.curriculumVersion || c.curriculumVersion === form.curriculumVersion)
            );
            const titles = matchingCurr.map(c => c.subject);
            return subjects.value.filter(s => titles.includes(s.title));
        });

        const getPeriodName = (id) => {
            const p = periods.value.find(ap => ap.id === id);
            return p ? p.name : 'Unknown Period';
        };

        const getSectionCohortCode = (id) => {
            const sec = sections.value.find(s => s.id === id);
            return sec ? `${sec.program} - ${sec.yearLevel} - ${sec.code}` : 'Unassigned';
        };

        const onSectionSelect = () => {
            const sec = sections.value.find(s => s.id === parseInt(form.sectionId));
            if (sec) {
                form.program = sec.program;
                form.yearLevel = sec.yearLevel;
                const period = periods.value.find(p => p.id === sec.academicPeriodId);
                form.semester = period ? period.semester : '1st Semester';
                form.curriculumVersion = sec.curriculumVersion || '2022 Curriculum';
                form.capacity = sec.capacity;
                form.code = '';
                form.subject = '';
            }
        };

        const onSubjectSelect = () => {
            if (!form.sectionId || !form.subject) return;
            const sec = sections.value.find(s => s.id === parseInt(form.sectionId));
            const sub = subjects.value.find(s => s.title === form.subject);
            if (sec && sub) {
                const progObj = programs.value.find(p => p.name === sec.program);
                const progCode = progObj ? progObj.code : sec.program;
                const progShort = progCode.replace('BS', '');
                form.code = progShort + '-' + sub.code + '-' + sec.code;
            }
        };

        // ── Helpers ──
        const notify = (ok, msg) => {
            successMsg.value = ''; errorMsg.value = '';
            if (ok) successMsg.value = msg; else errorMsg.value = msg;
            setTimeout(() => { successMsg.value = ''; errorMsg.value = ''; }, 4000);
        };
        const closeModal = () => { modal.value = ''; Object.keys(form).forEach(k => delete form[k]); };
        
        let courseChartInstance = null;

        const renderCourseChart = () => {
            if (!dashboardStats.value || !dashboardStats.value.programsDist) return;
            const ctx = document.getElementById('regByCourseChart');
            if (!ctx || typeof Chart === 'undefined') return;

            const dist = dashboardStats.value.programsDist || [];
            const labels = dist.map(p => p.program);
            const counts = dist.map(p => p.count);

            const palette = [
                '#006A4E', '#D4AF37', '#0ea5e9', '#a855f7', '#f59e0b', 
                '#10b981', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'
            ];

            if (courseChartInstance) {
                courseChartInstance.data.labels = labels.length > 0 ? labels : ['No Data'];
                courseChartInstance.data.datasets[0].data = counts.length > 0 ? counts : [0];
                courseChartInstance.data.datasets[0].backgroundColor = palette.slice(0, Math.max(labels.length, 1));
                courseChartInstance.update('none');
                return;
            }

            courseChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ['No Data'],
                    datasets: [{
                        label: 'Registrations',
                        data: counts.length > 0 ? counts : [0],
                        backgroundColor: palette.slice(0, Math.max(labels.length, 1)),
                        borderColor: '#ffffff',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        hoverBackgroundColor: '#D4AF37'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 34, 23, 0.92)',
                            titleFont: { family: 'Montserrat', size: 12, weight: 'bold' },
                            bodyFont: { family: 'Open Sans', size: 12 },
                            padding: 10,
                            displayColors: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Open Sans', size: 11 }, color: '#64748b' }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: { precision: 0, font: { family: 'Open Sans', size: 11 }, color: '#64748b' }
                        }
                    }
                }
            });
        };

        const loadDashboard = () => {
            isLoadingStats.value = true;
            get('fetch_dashboard_stats').then(res => {
                isLoadingStats.value = false;
                if (res.success) {
                    dashboardStats.value = res.data;
                    setTimeout(renderCourseChart, 100);
                }
            }).catch(() => { isLoadingStats.value = false; });
        };

        const loadAll = (silent = false) => {
            get('fetch_academic_data').then(res => {
                if (res.success && res.data) {
                    departments.value    = res.data.departments    || [];
                    programs.value       = res.data.programs       || [];
                    subjects.value       = res.data.subjects       || [];
                    curriculum.value     = res.data.curriculum     || [];
                    periods.value        = res.data.periods        || [];
                    sections.value       = res.data.sections       || [];
                    classOfferings.value = res.data.classOfferings || [];
                    fees.value           = res.data.fees           || [];
                    students.value       = res.data.students       || [];
                }
            });
            fetchOperators();
            fetchAnnouncements();
            if (view.value === 'dashboard') {
                loadDashboard();
            }
        };

        // Announcement State & Methods
        const announcements = ref([]);
        const announcementForm = reactive({
            id: null,
            title: '',
            category: 'GENERAL',
            content: '',
            image_url: '',
            target_audience: 'ALL',
            is_pinned: false,
            status: 'PUBLISHED'
        });
        const isUploadingAnnouncementImg = ref(false);
        const uploadImgPreview = ref('');
        const isSavingAnnouncement = ref(false);

        const fetchAnnouncements = () => {
            AdminModel.fetchAnnouncements().then(res => {
                if (res.success && Array.isArray(res.data)) {
                    announcements.value = res.data;
                }
            }).catch(e => console.error('[Admin] Failed to load announcements', e));
        };

        const openAnnouncementModal = (item = null) => {
            if (item) {
                announcementForm.id = item.id;
                announcementForm.title = item.title;
                announcementForm.category = item.category || 'GENERAL';
                announcementForm.content = item.content;
                announcementForm.image_url = item.image_url || '';
                announcementForm.target_audience = item.target_audience || 'ALL';
                announcementForm.is_pinned = !!parseInt(item.is_pinned);
                announcementForm.status = item.status || 'PUBLISHED';
                uploadImgPreview.value = item.image_url || '';
            } else {
                announcementForm.id = null;
                announcementForm.title = '';
                announcementForm.category = 'GENERAL';
                announcementForm.content = '';
                announcementForm.image_url = '';
                announcementForm.target_audience = 'ALL';
                announcementForm.is_pinned = false;
                announcementForm.status = 'PUBLISHED';
                uploadImgPreview.value = '';
            }
            modal.value = 'announcement';
        };

        const handleAnnouncementImageSelect = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            isUploadingAnnouncementImg.value = true;
            AdminModel.uploadAnnouncementImage(file).then(res => {
                isUploadingAnnouncementImg.value = false;
                if (res.success) {
                    const imgPath = res.data && res.data.image_url ? res.data.image_url : res.image_url;
                    announcementForm.image_url = imgPath;
                    uploadImgPreview.value = imgPath;
                    notify(true, 'Image uploaded successfully.');
                } else {
                    notify(false, res.message || res.error || 'Failed to upload image.');
                }
            }).catch(err => {
                isUploadingAnnouncementImg.value = false;
                notify(false, 'Image upload failed.');
            });
        };

        const removeAnnouncementImage = () => {
            announcementForm.image_url = '';
            uploadImgPreview.value = '';
        };

        const saveAnnouncement = () => {
            if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
                notify(false, 'Announcement title and content are required.');
                return;
            }
            isSavingAnnouncement.value = true;
            AdminModel.saveAnnouncement(announcementForm).then(res => {
                isSavingAnnouncement.value = false;
                if (res.success) {
                    notify(true, res.message || 'Announcement saved.');
                    closeModal();
                    fetchAnnouncements();
                } else {
                    notify(false, res.message || res.error || 'Failed to save announcement.');
                }
            }).catch(() => {
                isSavingAnnouncement.value = false;
                notify(false, 'Save request failed.');
            });
        };

        const deleteAnnouncement = (id) => {
            Swal.fire({
                title: 'Delete Announcement?',
                text: 'This post will be permanently removed and students will no longer see it.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, Delete It'
            }).then(result => {
                if (!result.isConfirmed) return;
                AdminModel.deleteAnnouncement(id).then(res => {
                    if (res.success) {
                        notify(true, 'Announcement deleted.');
                        fetchAnnouncements();
                    } else {
                        notify(false, res.message || 'Failed to delete announcement.');
                    }
                });
            });
        };

        const togglePinAnnouncement = (item) => {
            const payload = {
                ...item,
                is_pinned: !item.is_pinned
            };
            AdminModel.saveAnnouncement(payload).then(res => {
                if (res.success) {
                    notify(true, item.is_pinned ? 'Post unpinned.' : 'Post pinned to top.');
                    fetchAnnouncements();
                }
            });
        };

        const fetchOperators = () => {
            get('fetch_users').then(r => {
                if (r.success) users.value = r.data || [];
            });
        };

        const getProfile = () => {
            fetch('../api/index.php?action=auth/profile')
                .then(res => res.json())
                .then(res => {
                    if (res.success && res.data) {
                        currentAdmin.value = { ...currentAdmin.value, ...res.data };
                        const key = (currentAdmin.value.role === 'SUPER_ADMIN' || currentAdmin.value.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                        sessionStorage.setItem(key, JSON.stringify(currentAdmin.value));
                    }
                }).catch(() => {});
        };

        onMounted(() => {
            const s = sessionStorage.getItem('gncp_admin_user') || sessionStorage.getItem('gncp_station_user');
            if (s) {
                try {
                    const u = JSON.parse(s);
                    if (u && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN')) {
                        currentAdmin.value = u;
                        getProfile();
                        if (u.must_change_password && typeof window.PasswordChangeGuard !== 'undefined') {
                            window.PasswordChangeGuard.checkAndPrompt(u, function() {
                                loadAll();
                                startLiveSync();
                            });
                        } else {
                            loadAll();
                            startLiveSync();
                        }
                        return;
                    }
                } catch(e) {}
            }
            sessionStorage.removeItem('gncp_admin_user');
            sessionStorage.removeItem('gncp_station_user');
            window.location.href = '../index.html?clear=true&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        });

        onUnmounted(() => {
            stopLiveSync();
        });

        const logout = () => {
            fetch('../api/index.php?action=auth/logout', { method: 'POST' }).finally(() => {
                sessionStorage.removeItem('gncp_admin_user');
                sessionStorage.removeItem('gncp_station_user');
                window.location.href = '../index.html?logout=true';
            });
        };

        const setView = v => {
            view.value = v; search.value = ''; modal.value = '';
            if (v === 'dashboard') loadDashboard();
            if (v === 'announcements') fetchAnnouncements();
            if (v === 'operators') fetchOperators();
        };

        // ── Open modals ──
        const openAddModal = () => {
            search.value = '';
            if (view.value === 'announcements') { openAnnouncementModal(); return; }
            if (view.value === 'operators')     { openCreateOperatorModal(); return; }
            if (view.value === 'departments_programs') { Object.assign(form, {id:null,code:'',name:'',department:selectedDeptName.value || '',status:'Active'}); modal.value='program'; }
            if (view.value === 'subjects')   { Object.assign(form, {id:null,code:'',title:'',description:'',lectureUnits:3,labUnits:0,labFee:0,department:'',prerequisites:'None'}); modal.value='subject'; }
            if (view.value === 'curriculum') { Object.assign(form, {id:null,program:'',curriculumVersion:'2022 Curriculum',subject:'',yearLevel:'1st Year',semester:'1st Semester',elective:false}); modal.value='curriculum'; }
            if (view.value === 'periods')    { Object.assign(form, {id:null,name:'',academicYear:'',semester:'1st Semester',enrollmentStart:'',enrollmentEnd:'',status:'Active'}); modal.value='period'; }
            if (view.value === 'sections')   { Object.assign(form, {id:null,code:'',program:'',yearLevel:'1st Year',academicPeriodId:'',curriculumVersion:'2022 Curriculum',capacity:40,adviser:''}); modal.value='section'; }
            if (view.value === 'classOfferings') { Object.assign(form, {id:null,sectionId:'',program:'',yearLevel:'1st Year',semester:'1st Semester',subject:'',code:'',instructor:'TBD',days:'MWF',time:'09:00 AM - 10:30 AM',room:'Room 101',capacity:40}); modal.value='classOffering'; }
            if (view.value === 'fees')       { Object.assign(form, {id:null,type:'Tuition',label:'',amount:0,perUnit:false}); modal.value='fee'; }
        };
        const editDepartment = d => { Object.assign(form, {...d}); modal.value='department'; };
        const editProgram    = p => { Object.assign(form, {...p}); modal.value='program'; };
        const editSubject    = s => { Object.assign(form, {...s}); modal.value='subject'; };
        const editCurriculum = c => { Object.assign(form, {...c}); modal.value='curriculum'; };
        const editPeriod     = p => { Object.assign(form, {...p}); modal.value='period'; };
        const editSection    = s => { Object.assign(form, {...s}); modal.value='section'; };
        const editClassOffering = c => { Object.assign(form, {...c}); modal.value='classOffering'; };
        const editFee        = f => { Object.assign(form, {...f}); modal.value='fee'; };

        // Wizard & Accelerators Modals opening
        const openAddDepartmentModal = () => {
            Object.assign(form, {id:null,code:'',name:'',status:'Active'});
            modal.value = 'department';
        };
        const openAddProgramModal = () => {
            Object.assign(form, {id:null,code:'',name:'',department:selectedDeptName.value || '',status:'Active'});
            modal.value = 'program';
        };
        const openCloneTermModal = () => {
            cloneForm.fromPeriodId = periods.value.length > 0 ? periods.value[0].id : '';
            cloneForm.newPeriodName = '';
            cloneForm.newAcademicYear = '';
            cloneForm.newSemester = '1st Semester';
            cloneForm.enrollmentStart = '';
            cloneForm.enrollmentEnd = '';
            cloneForm.cloneSections = true;
            cloneForm.cloneOfferings = true;
            modal.value = 'clone-term';
        };
        const openBulkSectionsModal = () => {
            bulkForm.program = programs.value.length > 0 ? programs.value[0].name : '';
            bulkForm.curriculumVersion = '2022 Curriculum';
            bulkForm.yearLevel = '1st Year';
            bulkForm.academicPeriodId = periods.value.length > 0 ? periods.value[0].id : '';
            bulkForm.capacity = 40;
            bulkForm.adviser = '';
            bulkForm.count = 3;
            modal.value = 'bulk-sections';
        };

        const submitCloneTerm = () => {
            if (!cloneForm.fromPeriodId || !cloneForm.newPeriodName || !cloneForm.newAcademicYear) {
                notify(false, 'Please fill in all required fields.');
                return;
            }
            post('clone_term', cloneForm).then(r => {
                if (r.success) {
                    notify(true, 'Term cloned successfully with options.');
                    closeModal();
                    loadAll();
                } else notify(false, r.error || 'Cloning failed.');
            });
        };

        const onBulkProgramSelect = () => {
            const versions = uniqueCurriculumVersionsForBulk.value;
            if (versions.length > 0) {
                bulkForm.curriculumVersion = versions[0];
            }
        };

        const submitBulkSections = () => {
            if (!bulkForm.program || !bulkForm.academicPeriodId || !bulkForm.count) {
                notify(false, 'Program, Academic Period, and Count are required.');
                return;
            }
            post('bulk_sections', bulkForm).then(r => {
                if (r.success) {
                    notify(true, `${r.createdCount || bulkForm.count} Sections created successfully.`);
                    closeModal();
                    loadAll();
                } else notify(false, r.error || 'Bulk creation failed.');
            });
        };

        // ── Save handlers ──
        const saveDepartment = () => {
            post('save_department', { department: form }).then(r => {
                if (r.success) { notify(true, 'Department saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteDepartment = id => {
            if (!confirm('Delete this department? Associated programs may be orphaned.')) return;
            post('delete_department', { id }).then(r => {
                if (r.success) { notify(true, 'Department deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveProgram = () => {
            post('save_program', { program: form }).then(r => {
                if (r.success) { notify(true, 'Program saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteProgram = id => {
            if (!confirm('Delete this program?')) return;
            post('delete_program', { id }).then(r => {
                if (r.success) { notify(true, 'Program deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveSubject = () => {
            post('save_subject', { subject: form }).then(r => {
                if (r.success) { notify(true, 'Subject saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteSubject = id => {
            if (!confirm('Delete this subject?')) return;
            post('delete_subject', { id }).then(r => {
                if (r.success) { notify(true, 'Subject deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveCurriculum = () => {
            post('save_curriculum', { curriculum: form }).then(r => {
                if (r.success) { notify(true, 'Curriculum entry saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteCurriculum = id => {
            if (!confirm('Delete this curriculum entry?')) return;
            post('delete_curriculum', { id }).then(r => {
                if (r.success) { notify(true, 'Curriculum entry deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const savePeriod = () => {
            post('save_period', { period: form }).then(r => {
                if (r.success) { notify(true, 'Academic period saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deletePeriod = id => {
            if (!confirm('Delete this period?')) return;
            post('delete_period', { id }).then(r => {
                if (r.success) { notify(true, 'Period deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveSection = () => {
            post('save_section', { section: form }).then(r => {
                if (r.success) { notify(true, 'Cohort Section saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };

        const openBlockSectionModal = (s) => {
            Object.assign(form, { ...s });
            modal.value = 'section';
        };

        const saveBlockSection = () => {
            saveSection();
        };

        const deleteSection = id => {
            if (!confirm('Delete this section? Offerings assigned to this section will be deleted.')) return;
            post('delete_section', { id }).then(r => {
                if (r.success) { notify(true, 'Section deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveClassOffering = () => {
            post('save_class_offering', { offering: form }).then(r => {
                if (r.success) { notify(true, 'Class offering schedule saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteClassOffering = id => {
            if (!confirm('Delete this class offering schedule?')) return;
            post('delete_class_offering', { id }).then(r => {
                if (r.success) { notify(true, 'Class offering schedule deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        const saveFee = () => {
            post('save_fee', { fee: form }).then(r => {
                if (r.success) { notify(true, 'Fee saved.'); closeModal(); loadAll(); }
                else notify(false, r.error || 'Save failed.');
            });
        };
        const deleteFee = id => {
            if (!confirm('Delete this fee entry?')) return;
            post('delete_fee', { id }).then(r => {
                if (r.success) { notify(true, 'Fee deleted.'); loadAll(); }
                else notify(false, r.error || 'Delete failed.');
            });
        };

        // Operator account creation and management (Decoupled & Isolated)
        const openCreateOperatorModal = () => {
            console.log('[Trace: Operators] Triggered Open Create Operator Modal');
            Object.assign(operatorForm, { id: null, name: '', email: '', username: '', password: '', role: 'REGISTRAR' });
            isOperatorModalOpen.value = true;
        };

        const closeCreateOperatorModal = () => {
            if (isSubmittingOperator.value) return;
            console.log('[Trace: Operators] Closing Create Operator Modal');
            isOperatorModalOpen.value = false;
        };

        const submitCreateOperator = () => {
            console.log('[Trace: Operators] Submitting new operator:', operatorForm);
            if (!operatorForm.name || !operatorForm.username || !operatorForm.role) {
                Swal.fire({
                    title: 'Missing Information',
                    text: 'Full name, username, and assigned station role are required.',
                    icon: 'warning',
                    confirmButtonColor: '#006A4E'
                });
                return;
            }

            const payloadName = operatorForm.name;
            const payloadUsername = operatorForm.username;
            const payloadRole = operatorForm.role;

            isSubmittingOperator.value = true;

            post('save_user', { user: { ...operatorForm } }).then(r => {
                isSubmittingOperator.value = false;
                if (r.success) {
                    console.log('[Trace: Operators] Operator account created successfully:', r);
                    closeCreateOperatorModal();
                    fetchOperators();

                    const pass = (r.data && r.data.tempPassword) ? r.data.tempPassword : (operatorForm.password || '(As specified)');
                    const emailSent = r.data && r.data.emailSent;
                    const emailMsg = r.data && r.data.emailMessage ? r.data.emailMessage : '';

                    Swal.fire({
                        title: 'Operator Created Successfully!',
                        html: `
                            <div style="text-align: left; padding: 14px 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 10px;">
                                <div style="margin-bottom: 8px;"><strong>Operator Name:</strong> ${payloadName}</div>
                                <div style="margin-bottom: 8px;"><strong>Username:</strong> <code style="color: #006A4E; font-weight: 700; font-size: 1rem;">${payloadUsername}</code></div>
                                <div style="margin-bottom: 8px;"><strong>Station Role:</strong> <span class="badge badge-role">${payloadRole}</span></div>
                                <div style="margin-bottom: 12px;"><strong>Temporary Password:</strong><br><code style="font-size: 1.2rem; color: #006A4E; background: #e6f4ed; padding: 6px 14px; border-radius: 6px; display: inline-block; margin-top: 4px; font-weight: bold;">${pass}</code></div>
                                <div style="font-size: 0.85rem; padding: 10px 14px; border-radius: 6px; background: ${emailSent ? '#d1fae5' : '#fef3c7'}; color: ${emailSent ? '#065f46' : '#92400e'}; border: 1px solid ${emailSent ? '#a7f3d0' : '#fde68a'};">
                                    <i class="fa-solid ${emailSent ? 'fa-envelope-circle-check' : 'fa-info-circle'}" style="margin-right: 6px;"></i>
                                    ${emailSent ? 'Account credentials have been emailed to the operator.' : (emailMsg || 'No email specified or running in local mode.')}
                                </div>
                            </div>
                        `,
                        icon: 'success',
                        confirmButtonColor: '#006A4E',
                        confirmButtonText: 'Done & Return'
                    });
                } else {
                    console.error('[Trace: Operators] Create operator failed:', r);
                    Swal.fire({
                        title: 'Account Creation Failed',
                        html: `<div style="color:#dc2626;font-weight:600">${r.message || r.error || 'Failed to create operator account.'}</div>`,
                        icon: 'error',
                        confirmButtonColor: '#006A4E'
                    });
                }
            }).catch(err => {
                isSubmittingOperator.value = false;
                console.error('[Trace: Operators] Network error creating operator:', err);
                Swal.fire({
                    title: 'Server Error',
                    text: 'An error occurred while connecting to the server.',
                    icon: 'error',
                    confirmButtonColor: '#006A4E'
                });
            });
        };

        const openEditOperatorModal = (u) => {
            console.log('[Trace: Operators] Triggered Edit Operator Modal for user:', u);
            Object.assign(operatorForm, { id: u.id, name: u.name, username: u.username, email: u.email || '', role: u.role, password: '' });
            isEditOperatorModalOpen.value = true;
        };

        const closeEditOperatorModal = () => {
            if (isSubmittingOperator.value) return;
            console.log('[Trace: Operators] Closing Edit Operator Modal');
            isEditOperatorModalOpen.value = false;
        };

        const submitEditOperator = () => {
            console.log('[Trace: Operators] Submitting operator update:', operatorForm);
            if (!operatorForm.name || !operatorForm.role) {
                Swal.fire({
                    title: 'Missing Required Fields',
                    text: 'Full Name and Station Role are required.',
                    icon: 'warning',
                    confirmButtonColor: '#006A4E'
                });
                return;
            }

            const targetName = operatorForm.name;
            isSubmittingOperator.value = true;

            post('update_operator', {
                userId: operatorForm.id,
                name: operatorForm.name,
                email: operatorForm.email,
                role: operatorForm.role
            }).then(r => {
                isSubmittingOperator.value = false;
                if (r.success) {
                    console.log('[Trace: Operators] Operator updated successfully:', r);
                    closeEditOperatorModal();
                    fetchOperators();
                    Swal.fire({
                        title: 'Operator Updated!',
                        text: `Account details for ${targetName} have been updated successfully.`,
                        icon: 'success',
                        confirmButtonColor: '#006A4E'
                    });
                } else {
                    console.error('[Trace: Operators] Update operator failed:', r);
                    Swal.fire({
                        title: 'Update Failed',
                        text: r.message || r.error || 'Failed to update operator account.',
                        icon: 'error',
                        confirmButtonColor: '#006A4E'
                    });
                }
            }).catch(err => {
                isSubmittingOperator.value = false;
                console.error('[Trace: Operators] Network error updating operator:', err);
                Swal.fire({
                    title: 'Server Error',
                    text: 'An error occurred while connecting to the server.',
                    icon: 'error',
                    confirmButtonColor: '#006A4E'
                });
            });
        };

        const resetOperatorPassword = (u) => {
            console.log('[Trace: Operators] Triggered Password Reset for user ID:', u.id);
            Swal.fire({
                title: 'Reset Operator Password?',
                text: `Generates a new temporary password for ${u.name} (${u.username}).`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#006A4E',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, Reset Password'
            }).then((res) => {
                if (res.isConfirmed) {
                    post('reset_operator_password', { userId: u.id }).then(r => {
                        if (r.success) {
                            console.log('[Trace: Operators] Password reset successful:', r);
                            fetchOperators();
                            const pass = r.data && r.data.tempPassword ? r.data.tempPassword : '(Password Updated)';
                            const emailSent = r.data && r.data.emailSent;

                            Swal.fire({
                                title: 'Password Reset Successful!',
                                html: `
                                    <div style="text-align: left; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px;">
                                        <div><strong>Operator:</strong> ${u.name}</div>
                                        <div style="margin-top: 6px;"><strong>New Temporary Password:</strong><br><code style="font-size: 1.15rem; color: #006A4E; background: #e6f4ed; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-top: 4px;">${pass}</code></div>
                                        <div style="margin-top: 10px; font-size: 0.85rem; color: ${emailSent ? '#059669' : '#d97706'};">
                                            <i class="fa-solid ${emailSent ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${emailSent ? 'New password sent via email.' : 'Local environment — please issue password manually.'}
                                        </div>
                                    </div>
                                `,
                                icon: 'success',
                                confirmButtonColor: '#006A4E'
                            });
                        } else {
                            console.error('[Trace: Operators] Password reset failed:', r);
                            Swal.fire({
                                title: 'Reset Failed',
                                text: r.message || r.error || 'Failed to reset operator password.',
                                icon: 'error',
                                confirmButtonColor: '#006A4E'
                            });
                        }
                    });
                }
            });
        };

        const updateStatus = (userId, status) => {
            console.log(`[Trace: Operators] Updating status for user ID ${userId} -> ${status}`);
            return post('update_user_status', { userId, status }).then(r => {
                if (r.success) fetchOperators();
                else notify(false, r.error || 'Failed to update status.');
            });
        };

        const deleteUser = async userId => {
            console.log(`[Trace: Operators] Requesting deletion for user ID ${userId}`);
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'Delete this operator account?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: 'Yes, delete it!'
            });
            if (!result.isConfirmed) return;
            post('delete_user', { userId }).then(r => {
                if (r.success) {
                    console.log(`[Trace: Operators] User ID ${userId} deleted`);
                    fetchOperators();
                } else {
                    console.error('[Trace: Operators] Delete user failed:', r);
                    notify(false, r.error || 'Failed to delete.');
                }
            });
        };

        const handleLogout = () => {
            Swal.fire({
                title: 'Sign Out?',
                text: 'Are you sure you want to log out of the Admin Workstation?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#006A4E',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, Sign Out'
            }).then((result) => {
                if (result.isConfirmed) {
                    fetch('../api/index.php?action=auth/logout', { method: 'POST' }).finally(() => {
                        sessionStorage.clear();
                        localStorage.removeItem('gncp_admin_user');
                        localStorage.removeItem('gncp_station_user');
                        window.location.href = '../index.html';
                    });
                }
            });
        };

        return {
            currentAdmin, isLoggingIn, loginError, loginForm, showOperatorPassword,
            view, search, modal, form, operatorForm, isOperatorModalOpen, isEditOperatorModalOpen, isSubmittingOperator,
            successMsg, errorMsg,
            departments, programs, subjects, curriculum, periods, sections, classOfferings, fees, users, students,
            eyebrow, viewTitle, addLabel, searchPlaceholder,
            filteredDepartments, filteredPrograms, filteredSubjects, filteredCurriculum,
            filteredPeriods, filteredSections, filteredClassOfferings, filteredFees, filteredUsers, filteredSubjectsForSection,
            filteredProgramsList, filteredStudents, filteredAccounts, uniqueCurriculumVersionsForBulk,
            handleLogout, setView, openAddModal, closeModal,
            editDepartment, editProgram, editSubject, editCurriculum, editPeriod, editSection, editClassOffering, editFee,
            saveDepartment, deleteDepartment, saveProgram, deleteProgram, saveSubject, deleteSubject,
            saveCurriculum, deleteCurriculum, savePeriod, deletePeriod,
            saveSection, deleteSection, saveClassOffering, deleteClassOffering, saveFee, deleteFee,
            openBlockSectionModal, saveBlockSection,
            openCreateOperatorModal, closeCreateOperatorModal, submitCreateOperator,
            openEditOperatorModal, closeEditOperatorModal, submitEditOperator,
            resetOperatorPassword, updateStatus, deleteUser,
            dashboardStats, isLoadingStats, loadDashboard, loadAll,
            // Sort & Filter
            sortKey, sortDir, sortBy,
            filterUserStatus,
            filterProgramDept, filterProgramStatus,
            filterSubjectDept, filterSubjectLab,
            filterCurrProgram, filterCurrYear, filterCurrSem,
            filterPeriodSem, filterPeriodStatus,
            filterSectPeriod, filterSectProgram, filterSectYear, filterSectSem,
            filterSectDays,
            // Views & Collapsibles
            currView, sectView, collapsedGroups,
            uniqueProgramDepts, uniqueSubjectDepts, uniqueCurriculumVersions, programStats,
            curriculumGrouped, toggleCurrGroup,
            getPeriodName, getSectionCohortCode, onSectionSelect, onSubjectSelect,
            
            // New state & helpers
            expandedCats, selectedDeptName, filterStudentProgram, filterStudentYear, filterStudentStatus,
            filterAccountProgram, filterAccountYear, filterAccountStatus,
            cloneForm, bulkForm,
            openAddDepartmentModal, openAddProgramModal, openCloneTermModal, openBulkSectionsModal,
            submitCloneTerm, submitBulkSections, onBulkProgramSelect,
            timeGreeting,
            // Announcements
            announcements, announcementForm, isUploadingAnnouncementImg, uploadImgPreview, isSavingAnnouncement,
            fetchAnnouncements, openAnnouncementModal, handleAnnouncementImageSelect, removeAnnouncementImage,
            saveAnnouncement, deleteAnnouncement, togglePinAnnouncement
        };
    }
}).mount('#admin-app');
