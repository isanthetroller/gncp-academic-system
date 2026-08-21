const { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } = Vue;

const API = 'backend/api.php';

const handleFetchResponse = async (res) => {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Invalid JSON response from server:', text);
        return { success: false, error: 'Server returned an invalid format. Check console logs for details.' };
    }
};

const post = (action, body) => fetch(`${API}?action=${action}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }).then(handleFetchResponse);
const get  = (action)        => fetch(`${API}?action=${action}`).then(handleFetchResponse);

const app = createApp({
    components: {
        'admin-sidebar': window.AdminSidebar
    },
    setup() {
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
                    loadAll();
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
        const view       = ref('dashboard');
        const search     = ref('');
        const modal      = ref('');
        const form       = reactive({});

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

        // Mobile Navigation State
        const isMobileMenuOpen = ref(false);

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

        // Sleek Executive Course Chart State & Spline Logic
        const chartViewMode = ref('spline'); // 'spline' | 'timeline' | 'bars'
        const hoveredChartPoint = ref(null);
        const setHoveredPoint = (p, idx) => {
            hoveredChartPoint.value = p;
        };

        const getSplinePath = (points, tension = 0.22) => {
            if (!points || points.length === 0) return '';
            if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
            
            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i > 0 ? i - 1 : i];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
                
                const cp1x = p1.x + (p2.x - p0.x) * tension;
                const cp1y = p1.y + (p2.y - p0.y) * tension;
                const cp2x = p2.x - (p3.x - p1.x) * tension;
                const cp2y = p2.y - (p3.y - p1.y) * tension;
                
                path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.x.toFixed(1)}`;
            }
            return path;
        };

        const getTooltipStyle = (pt, metrics) => {
            if (!pt || !metrics) return {};
            const pctX = (pt.x / metrics.width) * 100;
            const pctY = (pt.y / metrics.height) * 100;
            
            // Boundary-aware horizontal positioning to prevent left/right overflow
            let transformX = '-50%';
            if (pctX < 24) {
                transformX = '10px'; // align to the right of node
            } else if (pctX > 76) {
                transformX = 'calc(-100% - 10px)'; // align to the left of node
            }
            
            // Boundary-aware vertical positioning to prevent top overflow
            let transformY = '-100%';
            let marginTop = '-12px';
            if (pctY < 32) {
                transformY = '0%'; // flip downwards
                marginTop = '14px';
            }
            
            return {
                left: `${pctX}%`,
                top: `${pctY}%`,
                transform: `translate(${transformX}, ${transformY})`,
                marginTop: marginTop
            };
        };

        const courseAnalytics = computed(() => {
            const aliasMap = {
                'BSCOE': 'BSCpE',
                'CS': 'BSCS',
                'IT': 'BSIT',
                'BS Computer Science': 'BSCS',
                'BS Information Technology': 'BSIT',
                'BS Nursing': 'BSN',
                'BS Business Administration': 'BSBA',
                'BS Hospitality Management': 'BSHM',
                'BS Secondary Education': 'BSEd',
                'BS Computer Engineering': 'BSCpE'
            };

            const fixedOrder = ['BSCS', 'BSIT', 'BSCpE', 'BSBA', 'BSHM', 'BSN', 'BSEd'];

            let masterCodes = [];
            if (programs.value && programs.value.length > 0) {
                programs.value.forEach(p => {
                    let code = (p.code || p.name || '').trim();
                    if (aliasMap[code]) code = aliasMap[code];
                    if (code && !masterCodes.includes(code)) {
                        masterCodes.push(code);
                    }
                });
            }
            if (masterCodes.length === 0) {
                masterCodes = [...fixedOrder];
            } else {
                fixedOrder.forEach(fc => {
                    if (!masterCodes.includes(fc)) {
                        masterCodes.push(fc);
                    }
                });
            }

            const distMap = {};
            if (dashboardStats.value && dashboardStats.value.programsDist) {
                dashboardStats.value.programsDist.forEach(d => {
                    let rawProg = (d.program || '').trim();
                    let canonicalProg = aliasMap[rawProg] || rawProg;
                    distMap[canonicalProg] = (distMap[canonicalProg] || 0) + (parseInt(d.count) || 0);
                });
            }

            const distTotal = Object.values(distMap).reduce((a, b) => a + b, 0);
            const totalCount = distTotal > 0 ? distTotal : (dashboardStats.value ? (parseInt(dashboardStats.value.total) || 1) : 1);

            return masterCodes.map(code => {
                const count = distMap[code] || 0;
                const pct = totalCount > 0 ? ((count / totalCount) * 100) : 0;
                
                let enrolledCount = 0;
                if (students.value && students.value.length > 0) {
                    enrolledCount = students.value.filter(s => {
                        let sc = (s.program || s.course || '').trim();
                        if (aliasMap[sc]) sc = aliasMap[sc];
                        return sc === code;
                    }).length;
                } else if (dashboardStats.value && dashboardStats.value.enrolled) {
                    enrolledCount = Math.min(count, Math.round(count * 0.8));
                }

                const progObj = (programs.value || []).find(p => {
                    let c = (p.code || p.name || '').trim();
                    return c === code || aliasMap[c] === code;
                });
                const name = progObj ? progObj.name : code;

                return {
                    code,
                    name,
                    count,
                    enrolled: enrolledCount,
                    pct: pct.toFixed(1),
                    quota: 40
                };
            });
        });

        const graphMetrics = computed(() => {
            const list = courseAnalytics.value;
            // viewBox 640×220 with preserveAspectRatio="none" fills 100% of container width
            const width = 640;
            const height = 220;
            const padXLeft = 36;
            const padXRight = 36;
            const padY = 26;
            const plotW = width - padXLeft - padXRight;
            const plotH = height - (padY * 2);
            const bottomY = height - padY;

            if (!list || list.length === 0) {
                return {
                    maxVal: 5, width, height, padXLeft, padXRight, padX: padXLeft, padY, bottomY,
                    pointsTotal: [], pointsEnrolled: [],
                    totalSpline: '', enrolledSpline: '',
                    totalArea: '', enrolledArea: ''
                };
            }

            const rawMax = Math.max(...list.map(c => Math.max(c.count, c.enrolled)), 4);
            const maxVal = Math.ceil(rawMax * 1.2);
            const count = list.length;
            const stepX = count > 1 ? (plotW / (count - 1)) : (plotW / 2);

            const pointsTotal = list.map((c, i) => ({
                x: Math.round(padXLeft + (i * stepX)),
                // Clamp Y so zero-count programs sit on the baseline and spline never goes below
                y: c.count === 0
                    ? bottomY
                    : Math.min(bottomY, Math.max(padY, Math.round(bottomY - ((c.count / maxVal) * plotH)))),
                data: c
            }));

            const pointsEnrolled = list.map((c, i) => ({
                x: Math.round(padXLeft + (i * stepX)),
                y: c.enrolled === 0
                    ? bottomY
                    : Math.min(bottomY, Math.max(padY, Math.round(bottomY - ((c.enrolled / maxVal) * plotH)))),
                data: c
            }));

            // Use lower tension for smoother curves that don't overshoot at steep drops
            const totalSpline = getSplinePath(pointsTotal, 0.18);
            const enrolledSpline = getSplinePath(pointsEnrolled, 0.18);

            const firstX = pointsTotal[0].x;
            const lastX = pointsTotal[pointsTotal.length - 1].x;

            const totalArea = totalSpline ? `${totalSpline} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z` : '';
            const enrolledArea = enrolledSpline ? `${enrolledSpline} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z` : '';

            return {
                maxVal,
                width,
                height,
                padXLeft,
                padXRight,
                padX: padXLeft,
                padY,
                bottomY,
                pointsTotal,
                pointsEnrolled,
                totalSpline,
                enrolledSpline,
                totalArea,
                enrolledArea
            };
        });

        // 30-Day Timeline Spline Trend Analytics (MonkeyType Design Reference)
        const hoveredTimelinePoint = ref(null);

        const timelineData = computed(() => {
            if (dashboardStats.value && dashboardStats.value.timeline30 && dashboardStats.value.timeline30.length > 0) {
                return dashboardStats.value.timeline30;
            }
            const arr = [];
            const total = dashboardStats.value ? (parseInt(dashboardStats.value.total) || 6) : 6;
            for (let i = 29; i >= 0; i--) {
                const dayNum = 30 - i;
                const daily = (i === 0 ? 1 : i === 2 ? 1 : i === 5 ? 2 : (i === 15 || i === 22) ? 1 : 0);
                arr.push({
                    day: dayNum.toString(),
                    date: `Day ${dayNum}`,
                    daily: daily,
                    cumulative: Math.min(total, Math.max(1, Math.round(total * (dayNum / 30))))
                });
            }
            return arr;
        });

        const timelineGraphMetrics = computed(() => {
            const list = timelineData.value;
            const width = 640;
            const height = 200;
            const padXLeft = 38;
            const padXRight = 38;
            const padY = 24;
            const plotW = width - padXLeft - padXRight;
            const plotH = height - (padY * 2);
            const bottomY = height - padY;

            if (!list || list.length === 0) {
                return {
                    maxVal: 5, maxDaily: 2, width, height, padXLeft, padXRight, padY, bottomY,
                    pointsCum: [], pointsDaily: [],
                    cumSpline: '', dailySpline: '',
                    cumArea: '', dailyArea: ''
                };
            }

            const rawMaxDaily = Math.max(...list.map(d => d.daily), 2);
            const rawMaxCum = Math.max(...list.map(d => d.cumulative), 4);
            const maxVal = Math.ceil(rawMaxCum * 1.15);
            const maxDaily = Math.ceil(rawMaxDaily * 1.2);

            const count = list.length;
            const stepX = count > 1 ? (plotW / (count - 1)) : (plotW / 2);

            // Cumulative Total curve (Smooth Emerald Spline)
            const pointsCum = list.map((d, i) => ({
                x: Math.round(padXLeft + (i * stepX)),
                y: Math.min(bottomY, Math.max(padY, Math.round(bottomY - ((d.cumulative / maxVal) * plotH)))),
                data: d
            }));

            // Daily Velocity curve (Smooth Gold Spline)
            const pointsDaily = list.map((d, i) => ({
                x: Math.round(padXLeft + (i * stepX)),
                y: Math.min(bottomY, Math.max(padY, Math.round(bottomY - ((d.daily / maxDaily) * (plotH * 0.85))))),
                data: d
            }));

            const cumSpline = getSplinePath(pointsCum, 0.26);
            const dailySpline = getSplinePath(pointsDaily, 0.26);

            const firstX = pointsCum[0].x;
            const lastX = pointsCum[pointsCum.length - 1].x;

            const cumArea = cumSpline ? `${cumSpline} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z` : '';
            const dailyArea = dailySpline ? `${dailySpline} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z` : '';

            return {
                maxVal,
                maxDaily,
                width,
                height,
                padXLeft,
                padXRight,
                padY,
                bottomY,
                pointsCum,
                pointsDaily,
                cumSpline,
                dailySpline,
                cumArea,
                dailyArea
            };
        });

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

        // Grouped curriculum structure: Program -> Year Level -> Semester -> Entries
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
            if (ok) {
                successMsg.value = msg;
                errorMsg.value = '';
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: msg,
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true
                    });
                }
            } else {
                errorMsg.value = msg;
                successMsg.value = '';
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'error',
                        title: msg,
                        showConfirmButton: false,
                        timer: 3500,
                        timerProgressBar: true
                    });
                }
            }
            setTimeout(() => { successMsg.value = ''; errorMsg.value = ''; }, 4000);
        };
        const closeModal = () => { modal.value = ''; Object.keys(form).forEach(k => delete form[k]); };
        
        const loadDashboard = (silent = false) => {
            if (!silent) isLoadingStats.value = true;
            get('fetch_dashboard_stats').then(r => {
                if (!silent) isLoadingStats.value = false;
                if (r && r.success) dashboardStats.value = r.data;
            }).catch(() => { if (!silent) isLoadingStats.value = false; });
        };

        const setView    = (v) => { 
            view.value = v; 
            search.value = ''; 
            closeModal(); 
            if (v === 'dashboard') loadDashboard();
            if (v === 'operators') {
                filterUserStatus.value = 'ALL';
                get('fetch_users').then(r => { if (r && r.success) users.value = r.data || []; });
            }
        };

        // ── Auth ──
        const fetchCurrentProfile = () => {
            fetch('../api/index.php?action=auth/profile')
                .then(res => res.json())
                .then(res => {
                    if (res && res.success && res.data) {
                        const prof = res.data;
                        const avatarUrl = prof.avatar || prof.photo || prof.image || null;
                        if (currentAdmin.value) {
                            if (avatarUrl) currentAdmin.value.avatar = avatarUrl;
                            if (prof.name) currentAdmin.value.name = prof.name;
                            if (prof.email) currentAdmin.value.email = prof.email;
                            const key = (currentAdmin.value.role === 'SUPER_ADMIN' || currentAdmin.value.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                            sessionStorage.setItem(key, JSON.stringify(currentAdmin.value));
                            localStorage.setItem(key, JSON.stringify(currentAdmin.value));
                        }
                    }
                }).catch(() => {});
        };

        onMounted(() => {
            const s = sessionStorage.getItem('gncp_admin_user') || sessionStorage.getItem('gncp_station_user') || localStorage.getItem('gncp_admin_user') || localStorage.getItem('gncp_station_user');
            if (s) {
                try {
                    const u = JSON.parse(s);
                    if (u && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN')) {
                        currentAdmin.value = u;
                        fetchCurrentProfile();
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
            localStorage.removeItem('gncp_admin_user');
            localStorage.removeItem('gncp_station_user');
            window.location.href = '../index.html?clear=true&redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        });

        onUnmounted(() => {
            stopLiveSync();
        });

        const showLogoutConfirm = ref(false);

        const handleLogout = () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Confirm Logout',
                    text: 'Are you sure you want to log out of the Super Admin Portal?',
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
            currentAdmin.value = null;
            sessionStorage.removeItem('gncp_admin_user');
            sessionStorage.removeItem('gncp_station_user');
            localStorage.removeItem('gncp_admin_user');
            localStorage.removeItem('gncp_station_user');

            fetch('../api/index.php?action=auth/logout', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    window.location.replace('../index.html?clear=true&logout=true');
                });
        };

        // ── Announcements (Bulletin Board & Google Docs Editor) ──
        const announcements        = ref([]);
        const isSavingAnnouncement = ref(false);
        const uploadImgPreview     = ref('');
        const announcementForm     = reactive({
            id: null,
            title: '',
            category: 'GENERAL',
            target_audience: 'ALL',
            content: '',
            image_url: '',
            image_height: 320,
            image_width: 100,
            image_fit: 'cover',
            is_pinned: false
        });

        // ── Academic Milestones Management ──
        const milestones         = ref([]);
        const isSavingMilestone  = ref(false);
        const milestoneForm      = reactive({
            id: null,
            academic_period_id: null,
            title: '',
            date_start: '',
            date_end: '',
            date_display: '',
            status: 'SCHEDULED',
            display_order: 1
        });

        const editorWordCount = computed(() => {
            const canvas = typeof document !== 'undefined' ? document.getElementById('announcement-content-canvas') : null;
            const text = canvas ? canvas.innerText : (announcementForm.content || '').replace(/<[^>]*>/g, ' ');
            const words = text.trim().split(/\s+/).filter(Boolean);
            return words.length;
        });

        const editorCharCount = computed(() => {
            const canvas = typeof document !== 'undefined' ? document.getElementById('announcement-content-canvas') : null;
            const text = canvas ? canvas.innerText : (announcementForm.content || '').replace(/<[^>]*>/g, '');
            return text.trim().length;
        });

        const fetchAdminAnnouncements = () => {
            get('fetch_announcements').then(r => {
                if (r.success) announcements.value = r.data || [];
            }).catch(() => {});
        };

        const formatDoc = (cmd, val = null) => {
            const canvas = document.getElementById('announcement-content-canvas');
            if (canvas) canvas.focus();
            document.execCommand(cmd, false, val);
            syncEditorContent();
        };

        const applyFormatBlock = (e) => {
            const val = e.target.value;
            formatDoc('formatBlock', val === 'p' ? '<p>' : `<${val}>`);
        };

        const applyTextColor = (e) => {
            formatDoc('foreColor', e.target.value);
        };

        const applyHiliteColor = (e) => {
            formatDoc('hiliteColor', e.target.value);
        };

        const insertLink = async () => {
            const { value: url } = await Swal.fire({
                title: 'Insert Link',
                input: 'url',
                inputLabel: 'Web Address (URL)',
                inputPlaceholder: 'https://gncp.edu.ph/memo.pdf',
                showCancelButton: true,
                confirmButtonColor: '#006A4E'
            });
            if (url) {
                formatDoc('createLink', url);
            }
        };

        const syncEditorContent = () => {
            const canvas = document.getElementById('announcement-content-canvas');
            if (canvas) {
                announcementForm.content = canvas.innerHTML;
            }
        };

        const setImagePreset = (height, width = 100, fit = 'contain') => {
            announcementForm.image_height = height;
            announcementForm.image_width = width;
            announcementForm.image_fit = fit;
        };

        // ── Load all data ──
        const loadAll = () => {
            loadDashboard(true);
            get('fetch_academic_data').then(r => {
                if (r.success && r.data) {
                    departments.value = window.GNCP_DEPARTMENTS;
                    programs.value   = r.data.programs  || [];
                    subjects.value   = r.data.subjects  || [];
                    curriculum.value = r.data.curriculum|| [];
                    periods.value    = r.data.periods   || [];
                    milestones.value = r.data.milestones|| [];
                    sections.value   = r.data.sections  || [];
                    classOfferings.value = r.data.classOfferings || [];
                    fees.value       = r.data.fees      || [];
                    students.value   = r.data.students  || [];
                }
            });
            get('fetch_users').then(r => { if (r.success) users.value = r.data || []; });
            fetchAdminAnnouncements();
            fetchAdminMilestones();
        };

        const openAnnouncementModal = (item = null) => {
            uploadImgPreview.value = '';
            if (item) {
                Object.assign(announcementForm, {
                    id: item.id,
                    title: item.title || '',
                    author_name: item.author_name || 'Dr. Eleanor Vance (VP for Academic Affairs)',
                    category: item.category || 'GENERAL',
                    target_audience: item.target_audience || 'ALL',
                    content: item.content || '',
                    image_url: item.image_url || '',
                    image_height: item.image_height || 'auto',
                    image_width: item.image_width || 100,
                    image_fit: item.image_fit || 'contain',
                    is_pinned: parseInt(item.is_pinned) === 1
                });
            } else {
                const stored = sessionStorage.getItem('gncp_admin_user') || localStorage.getItem('gncp_admin_user');
                const admin = stored ? JSON.parse(stored) : {};
                Object.assign(announcementForm, {
                    id: null,
                    title: '',
                    author_name: admin.name || 'Dr. Eleanor Vance (VP for Academic Affairs)',
                    category: 'GENERAL',
                    target_audience: 'ALL',
                    content: '',
                    image_url: '',
                    image_height: 'auto',
                    image_width: 100,
                    image_fit: 'contain',
                    is_pinned: false
                });
            }
            modal.value = 'announcement';
            Vue.nextTick(() => {
                const canvas = document.getElementById('announcement-content-canvas');
                if (canvas) {
                    canvas.innerHTML = announcementForm.content || '';
                }
            });
        };

        const handleAnnouncementImageSelect = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => { uploadImgPreview.value = ev.target.result; };
            reader.readAsDataURL(file);
        };

        const removeAnnouncementImage = () => {
            uploadImgPreview.value = '';
            announcementForm.image_url = '';
        };

        const saveAnnouncement = async () => {
            syncEditorContent();
            const title = (announcementForm.title || '').trim();
            const rawContent = (announcementForm.content || '').trim();
            const textOnly = rawContent.replace(/<[^>]*>/g, '').trim();

            if (!title) {
                notify(false, 'Please enter an announcement title / headline.');
                return;
            }
            if (!textOnly && !uploadImgPreview.value && !announcementForm.image_url) {
                notify(false, 'Please write the announcement circular body content.');
                return;
            }

            isSavingAnnouncement.value = true;
            try {
                let imageUrl = announcementForm.image_url || '';
                if (uploadImgPreview.value && uploadImgPreview.value.startsWith('data:')) {
                    const formData = new FormData();
                    const blob = await (await fetch(uploadImgPreview.value)).blob();
                    formData.append('image', blob, 'banner.jpg');
                    const upRes = await fetch('backend/api.php?action=upload_announcement_image', { method: 'POST', body: formData });
                    const upJson = await upRes.json();
                    if (upJson.success) imageUrl = upJson.url;
                }
                const stored = sessionStorage.getItem('gncp_admin_user') || localStorage.getItem('gncp_admin_user');
                const admin = stored ? JSON.parse(stored) : {};
                const payload = {
                    id: announcementForm.id,
                    title: announcementForm.title,
                    author_name: (announcementForm.author_name || '').trim() || (admin.name || 'GNCP Administration'),
                    category: announcementForm.category,
                    target_audience: announcementForm.target_audience,
                    content: announcementForm.content,
                    image_url: imageUrl,
                    image_height: (announcementForm.image_height === 'auto' || !announcementForm.image_height) ? 'auto' : announcementForm.image_height,
                    image_width: announcementForm.image_width || 100,
                    image_fit: announcementForm.image_fit || 'contain',
                    is_pinned: announcementForm.is_pinned ? 1 : 0,
                    author_id: admin.id || 1
                };
                const r = await post('save_announcement', { announcement: payload });
                if (r.success) {
                    notify(true, announcementForm.id ? 'Announcement updated successfully.' : 'Official announcement published to campus feed.');
                    closeModal();
                    fetchAdminAnnouncements();
                } else {
                    notify(false, r.message || r.error || 'Failed to save announcement.');
                }
            } catch (e) {
                console.error('[Admin::Announcements] Save error:', e);
                notify(false, 'Unexpected error saving announcement.');
            }
            isSavingAnnouncement.value = false;
        };

        const deleteAnnouncement = async (id) => {
            const result = await Swal.fire({
                title: 'Delete Announcement?',
                text: 'This notice will be permanently removed from the student feed.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: 'Yes, delete it!'
            });
            if (!result.isConfirmed) return;
            post('delete_announcement', { id }).then(r => {
                if (r.success) {
                    notify(true, 'Announcement deleted successfully.');
                    fetchAdminAnnouncements();
                } else {
                    notify(false, r.message || r.error || 'Failed to delete.');
                }
            });
        };

        const togglePinAnnouncement = (item) => {
            post('save_announcement', { announcement: { ...item, is_pinned: parseInt(item.is_pinned) === 1 ? 0 : 1 } })
                .then(r => { if (r.success) fetchAdminAnnouncements(); });
        };

        // ── Academic Milestones Methods ──
        const fetchAdminMilestones = () => {
            get('fetch_milestones').then(r => {
                if (r && r.success && Array.isArray(r.data)) {
                    milestones.value = r.data;
                }
            }).catch(e => console.error('Failed to fetch milestones:', e));
        };

        const openMilestoneModal = (m = null) => {
            if (m) {
                milestoneForm.id                 = m.id;
                milestoneForm.academic_period_id = m.academic_period_id;
                milestoneForm.title              = m.title;
                milestoneForm.date_start         = m.date_start || '';
                milestoneForm.date_end           = m.date_end || '';
                milestoneForm.date_display       = m.date_display || '';
                milestoneForm.status             = m.status || 'SCHEDULED';
                milestoneForm.display_order      = m.display_order || 1;
            } else {
                milestoneForm.id                 = null;
                const activeP = periods.value.find(p => p.status === 'Active');
                milestoneForm.academic_period_id = activeP ? activeP.id : (periods.value.length > 0 ? periods.value[0].id : null);
                milestoneForm.title              = '';
                milestoneForm.date_start         = '';
                milestoneForm.date_end           = '';
                milestoneForm.date_display       = '';
                milestoneForm.status             = 'SCHEDULED';
                milestoneForm.display_order      = milestones.value.length + 1;
            }
            modal.value = 'milestone';
        };

        const updateMilestoneDisplayDate = () => {
            if (milestoneForm.date_start && milestoneForm.date_end) {
                try {
                    const s = new Date(milestoneForm.date_start + 'T00:00:00');
                    const e = new Date(milestoneForm.date_end + 'T00:00:00');
                    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
                        milestoneForm.date_display = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + e.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' });
                    } else {
                        milestoneForm.date_display = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                } catch (err) {}
            } else if (milestoneForm.date_start) {
                try {
                    milestoneForm.date_display = new Date(milestoneForm.date_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                } catch (err) {}
            }
        };

        const saveMilestone = async () => {
            if (!milestoneForm.title.trim()) {
                Swal.fire('Validation Error', 'Milestone title is required.', 'warning');
                return;
            }
            isSavingMilestone.value = true;
            try {
                const res = await post('save_milestone', { milestone: { ...milestoneForm } });
                if (res && res.success) {
                    notify(true, milestoneForm.id ? 'Academic milestone updated.' : 'Academic milestone created.');
                    closeModal();
                    fetchAdminMilestones();
                } else {
                    Swal.fire('Save Failed', res.message || res.error || 'Failed to save milestone.', 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'An unexpected error occurred.', 'error');
            } finally {
                isSavingMilestone.value = false;
            }
        };

        const deleteMilestone = async (id) => {
            const result = await Swal.fire({
                title: 'Delete Milestone?',
                text: 'Are you sure you want to remove this academic deadline?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, delete'
            });
            if (!result.isConfirmed) return;

            try {
                const res = await post('delete_milestone', { id });
                if (res && res.success) {
                    notify(true, 'Milestone deleted.');
                    fetchAdminMilestones();
                } else {
                    Swal.fire('Delete Failed', res.message || res.error || 'Failed to delete milestone.', 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Failed to delete milestone.', 'error');
            }
        };

        const getPeriodName = (periodId) => {
            if (!periodId) return 'All Semesters / General';
            const found = periods.value.find(p => parseInt(p.id) === parseInt(periodId));
            return found ? (found.name + (found.academic_year ? ' (A.Y. ' + found.academic_year + ')' : '')) : ('Term #' + periodId);
        };

        // ── Open modals ──
        const openAddModal = () => {
            search.value = '';
            if (view.value === 'departments_programs') { Object.assign(form, {id:null,code:'',name:'',department:selectedDeptName.value || '',status:'Active'}); modal.value='program'; }
            if (view.value === 'subjects')   { Object.assign(form, {id:null,code:'',title:'',description:'',lectureUnits:3,labUnits:0,labFee:0,department:'',prerequisites:'None'}); modal.value='subject'; }
            if (view.value === 'curriculum') { Object.assign(form, {id:null,program:'',curriculumVersion:'2022 Curriculum',subject:'',yearLevel:'1st Year',semester:'1st Semester',elective:false}); modal.value='curriculum'; }
            if (view.value === 'periods')    { Object.assign(form, {id:null,name:'',academicYear:'',semester:'1st Semester',enrollmentStart:'',enrollmentEnd:'',status:'Active'}); modal.value='period'; }
            if (view.value === 'sections')   { Object.assign(form, {id:null,code:'',program:'',yearLevel:'1st Year',academicPeriodId:'',curriculumVersion:'2022 Curriculum',capacity:40,adviser:''}); modal.value='section'; }
            if (view.value === 'classOfferings') { Object.assign(form, {id:null,sectionId:'',program:'',yearLevel:'1st Year',semester:'1st Semester',subject:'',code:'',instructor:'TBD',days:'MWF',time:'09:00 AM - 10:30 AM',room:'Room 101',capacity:40}); modal.value='classOffering'; }
            if (view.value === 'fees')       { Object.assign(form, {id:null,type:'Tuition',label:'',amount:0,perUnit:false}); modal.value='fee'; }
            if (view.value === 'operators')  { Object.assign(form, {name:'',username:'',password:'',role:''}); modal.value='operator'; }
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
            post('clone_term', { clone: cloneForm }).then(r => {
                if (r.success && r.data) {
                    periods.value = r.data.periods || [];
                    sections.value = r.data.sections || [];
                    classOfferings.value = r.data.classOfferings || [];
                    closeModal();
                    notify(true, r.message || 'Term cloned successfully!');
                } else {
                    notify(false, r.error || 'Failed to clone term.');
                }
            });
        };

        const submitBulkSections = () => {
            if (!bulkForm.program || !bulkForm.yearLevel || !bulkForm.academicPeriodId || bulkForm.count <= 0) {
                notify(false, 'Please fill in all required fields.');
                return;
            }
            post('bulk_generate_sections', { bulk: bulkForm }).then(r => {
                if (r.success && r.data) {
                    sections.value = r.data.sections || r.data || [];
                    closeModal();
                    notify(true, r.message || 'Sections generated successfully!');
                } else {
                    notify(false, r.error || 'Failed to generate sections.');
                }
            });
        };
        const onBulkProgramSelect = () => {
            const matching = curriculum.value.filter(c => c.program === bulkForm.program);
            if (matching.length > 0) {
                bulkForm.curriculumVersion = matching[0].curriculumVersion;
            } else {
                bulkForm.curriculumVersion = '2022 Curriculum';
            }
        };

        // ── CRUD helpers ──
        const crudSave = (action, bodyKey, dataList, payload) =>
            post(action, {[bodyKey]: {...form, ...payload}}).then(r => {
                if (r.success) { dataList.value = r.data; closeModal(); notify(true, 'Saved successfully.'); }
                else notify(false, r.error || 'Save failed.');
            });
        const crudDel = async (action, id, dataList, label) => {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: `Delete this ${label}? This cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: 'Yes, delete it!'
            });
            if (!result.isConfirmed) return;
            post(action, {id}).then(r => {
                if (r.success) { dataList.value = r.data; notify(true, `${label} deleted.`); }
                else Swal.fire({ title: 'Cannot Delete', html: r.error || 'Delete failed.', icon: 'error', confirmButtonColor: '#006A4E' });
            });
        };

        const saveDepartment = () => {
            Swal.fire({ icon: 'warning', title: 'Action Locked', text: 'Collegiate departments are fixed and cannot be modified.' });
        };
        const deleteDepartment = () => {
            Swal.fire({ icon: 'warning', title: 'Action Locked', text: 'Collegiate departments are fixed and cannot be deleted.' });
        };
        const saveProgram    = () => crudSave('save_program',   'program',    programs,   {});
        const deleteProgram = async (id) => {
            const prog = programs.value.find(p => p.id === id);
            if (!prog) return;
            const currCount = curriculum.value.filter(c => c.program === prog.name).length;
            const secCount = sections.value.filter(s => s.program === prog.name).length;
            const offCount = classOfferings.value.filter(o => o.program === prog.name).length;
            let warningHtml = `<p style="margin-bottom:8px">You are about to delete <strong>${prog.name}</strong> (${prog.code}).</p>`;
            if (currCount > 0 || secCount > 0 || offCount > 0) {
                warningHtml += `<div style="text-align:left;background:#fff3cd;border-radius:8px;padding:10px 14px;margin-top:6px;font-size:.85rem">`;
                warningHtml += `<strong style="color:#856404"><i class="fa-solid fa-triangle-exclamation"></i> The following will also be deleted:</strong><ul style="margin:6px 0 0 16px;padding:0">`;
                if (currCount > 0) warningHtml += `<li>${currCount} curriculum mapping(s)</li>`;
                if (offCount > 0) warningHtml += `<li>${offCount} class offering(s)</li>`;
                if (secCount > 0) warningHtml += `<li>${secCount} section cohort(s)</li>`;
                warningHtml += `</ul></div>`;
            }
            const result = await Swal.fire({
                title: 'Delete Program?',
                html: warningHtml,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: 'Yes, delete everything'
            });
            if (!result.isConfirmed) return;
            post('delete_program', {id}).then(r => {
                if (r.success) {
                    programs.value = r.data;
                    // Refresh dependent lists since cascading deletions occurred
                    get('fetch_academic_data').then(rd => {
                        if (rd.success && rd.data) {
                            curriculum.value = rd.data.curriculum || [];
                            sections.value = rd.data.sections || [];
                            classOfferings.value = rd.data.classOfferings || [];
                        }
                    });
                    notify(true, `Program "${prog.name}" and all dependent data deleted.`);
                } else {
                    Swal.fire({ title: 'Cannot Delete', html: r.error || 'Delete failed.', icon: 'error', confirmButtonColor: '#006A4E' });
                }
            });
        };
        const saveSubject    = () => crudSave('save_subject',   'subject',    subjects,   {});
        const deleteSubject  = id => crudDel('delete_subject',  id,           subjects,   'subject');
        const saveCurriculum = () => crudSave('save_curriculum','curriculum', curriculum, {});
        const deleteCurriculum=id => crudDel('delete_curriculum',id,          curriculum, 'entry');
        const savePeriod     = () => crudSave('save_academic_period','period',periods,    {});
        const deletePeriod = async (id) => {
            const period = periods.value.find(p => p.id === id);
            if (!period) return;
            const linkedSections = sections.value.filter(s => s.academicPeriodId === id);
            const linkedOfferings = classOfferings.value.filter(o => linkedSections.some(s => s.id === o.sectionId));
            let warningHtml = `<p style="margin-bottom:8px">Delete academic period <strong>${period.name}</strong>?</p>`;
            if (linkedSections.length > 0 || linkedOfferings.length > 0) {
                warningHtml += `<div style="text-align:left;background:#f8d7da;border-radius:8px;padding:10px 14px;margin-top:6px;font-size:.85rem">`;
                warningHtml += `<strong style="color:#721c24"><i class="fa-solid fa-shield-halved"></i> This period has active linked records:</strong><ul style="margin:6px 0 0 16px;padding:0">`;
                if (linkedSections.length > 0) warningHtml += `<li>${linkedSections.length} section cohort(s)</li>`;
                if (linkedOfferings.length > 0) warningHtml += `<li>${linkedOfferings.length} class offering(s)</li>`;
                warningHtml += `</ul><p style="margin-top:6px;color:#721c24;font-weight:600">You must remove these first before deleting the period.</p></div>`;
            }
            const result = await Swal.fire({
                title: 'Delete Period?',
                html: warningHtml,
                icon: linkedSections.length > 0 ? 'error' : 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: linkedSections.length > 0 ? 'Try Anyway' : 'Yes, delete it'
            });
            if (!result.isConfirmed) return;
            post('delete_academic_period', {id}).then(r => {
                if (r.success) { periods.value = r.data; notify(true, 'Period deleted.'); }
                else Swal.fire({ title: 'Cannot Delete', html: r.error || 'Delete failed.', icon: 'error', confirmButtonColor: '#006A4E' });
            });
        };
        const saveSection    = () => crudSave('save_section',   'section',    sections,   {});
        const deleteSection = async (id) => {
            const sec = sections.value.find(s => s.id === id);
            if (!sec) return;
            const linkedOfferings = classOfferings.value.filter(o => o.sectionId === id);
            let warningHtml = `<p style="margin-bottom:8px">Delete section <strong>${sec.code}</strong> (${sec.program} — ${sec.yearLevel})?</p>`;
            if (linkedOfferings.length > 0) {
                warningHtml += `<div style="text-align:left;background:#f8d7da;border-radius:8px;padding:10px 14px;margin-top:6px;font-size:.85rem">`;
                warningHtml += `<strong style="color:#721c24"><i class="fa-solid fa-shield-halved"></i> This section has active linked records:</strong><ul style="margin:6px 0 0 16px;padding:0">`;
                if (linkedOfferings.length > 0) warningHtml += `<li>${linkedOfferings.length} class offering(s) scheduled</li>`;
                warningHtml += `</ul><p style="margin-top:6px;color:#721c24;font-weight:600">You must remove these first before deleting the section.</p></div>`;
            }
            const result = await Swal.fire({
                title: 'Delete Section?',
                html: warningHtml,
                icon: linkedOfferings.length > 0 ? 'error' : 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#006A4E',
                confirmButtonText: linkedOfferings.length > 0 ? 'Try Anyway' : 'Yes, delete it'
            });
            if (!result.isConfirmed) return;
            post('delete_section', {id}).then(r => {
                if (r.success) { sections.value = r.data; notify(true, 'Section deleted.'); }
                else Swal.fire({ title: 'Cannot Delete', html: r.error || 'Delete failed.', icon: 'error', confirmButtonColor: '#006A4E' });
            });
        };
        const saveClassOffering = () => crudSave('save_subject_section', 'section', classOfferings, {});
        const deleteClassOffering = id => crudDel('delete_subject_section', id, classOfferings, 'class offering');
        const openBlockSectionModal = () => {
            Object.assign(form, {
                program: '',
                yearLevel: '1st Year',
                semester: '1st Semester',
                sectionSuffix: '',
                capacity: 40,
                instructor: 'TBD',
                days: 'MWF',
                time: '09:00 AM - 10:30 AM',
                room: 'Room 101'
            });
            modal.value = 'block-section';
        };
        const saveBlockSection = () => {
            if (!form.program || !form.yearLevel || !form.semester || !form.sectionSuffix) {
                notify(false, 'Please fill in all required fields.');
                return;
            }
            post('save_block_section', { block: form }).then(r => {
                if (r.success) {
                    classOfferings.value = r.data;
                    closeModal();
                    notify(true, r.message || 'Block section generated successfully.');
                } else {
                    notify(false, r.error || 'Failed to generate block section.');
                }
            });
        };
        const saveFee        = () => crudSave('save_fee',       'fee',        fees,       {});
        const deleteFee      = id => crudDel('delete_fee',      id,           fees,       'fee');

        // ── Operator Management (Isolated Methods & Tracing) ──
        const fetchOperators = () => {
            console.log('[Trace: Operators] Fetching operators list...');
            return get('fetch_users').then(r => {
                if (r && r.success) {
                    users.value = r.data || [];
                    console.log(`[Trace: Operators] Loaded ${users.value.length} operators:`, users.value);
                } else {
                    console.error('[Trace: Operators] Failed to fetch operators:', r);
                }
            });
        };

        const openCreateOperatorModal = () => {
            console.log('[Trace: Operators] Triggered Create Operator Modal');
            search.value = '';
            Object.assign(operatorForm, { id: null, name: '', email: '', username: '', password: '', role: '' });
            isOperatorModalOpen.value = true;
            console.log('[Trace: Operators] isOperatorModalOpen set to true');
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
                Swal.fire({
                    title: 'Server Error',
                    text: 'An error occurred while connecting to the server.',
                    icon: 'error',
                    confirmButtonColor: '#006A4E'
                });
            });
        };

        const resetOperatorPassword = async (u) => {
            console.log('[Trace: Operators] Initiating password reset for user:', u);
            const { value: newPass } = await Swal.fire({
                title: 'Reset Operator Password',
                text: `Set a new temporary password for ${u.name} (${u.username}):`,
                input: 'text',
                inputPlaceholder: 'Leave blank to auto-generate',
                showCancelButton: true,
                confirmButtonColor: '#006A4E',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Reset Password'
            });
            if (newPass === undefined) return;
            post('reset_operator_password', { userId: u.id, newPassword: newPass }).then(r => {
                if (r.success) {
                    console.log('[Trace: Operators] Password reset successful:', r);
                    fetchOperators();
                    Swal.fire({
                        title: 'Password Reset Successful!',
                        html: `Temporary password for <strong>${u.username}</strong>:<br><br><code style="font-size:1.25rem;color:#006A4E;background:#e6f4ed;padding:6px 14px;border-radius:6px;display:inline-block">${r.data.tempPassword}</code><br><br>${r.data.emailSent ? 'Credentials have been emailed to the operator.' : (r.data.emailMessage || 'No email sent.')}`,
                        icon: 'success',
                        confirmButtonColor: '#006A4E'
                    });
                } else {
                    console.error('[Trace: Operators] Password reset failed:', r);
                    notify(false, r.message || r.error || 'Failed to reset password.');
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
        const onAvatarError = () => { avatarFailed.value = true; };

        const initials = computed(() => {
            const name = user.value.name || (currentAdmin.value ? currentAdmin.value.name : 'Super Admin');
            const parts = name.trim().split(' ').filter(Boolean);
            if (parts.length > 1) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return (parts[0] ? parts[0][0] : 'SA').toUpperCase();
        });

        const formattedAvatar = computed(() => {
            if (avatarFailed.value) return null;
            const avatar = user.value.avatar || (currentAdmin.value ? currentAdmin.value.avatar : null);
            if (!avatar) return null;
            if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) return avatar;
            if (avatar.startsWith('../')) return avatar;
            if (avatar.startsWith('uploads/')) return '../' + avatar;
            const filename = avatar.split('/').pop();
            return '../uploads/avatars/' + filename;
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
            avatarFailed.value = false;
            if (currentAdmin.value) {
                user.value.name = currentAdmin.value.name || '';
                user.value.email = currentAdmin.value.email || '';
                user.value.username = currentAdmin.value.username || 'admin';
                user.value.role = currentAdmin.value.role || 'SUPER_ADMIN';
                user.value.avatar = currentAdmin.value.avatar || null;
            }
            try {
                const username = user.value.username || (currentAdmin.value ? currentAdmin.value.username : 'admin');
                const res = await fetch('../api/index.php?action=auth/profile&username=' + encodeURIComponent(username));
                const data = await res.json();
                if (data.success && data.data) {
                    user.value = { ...user.value, ...data.data };
                    if (data.data.avatar) {
                        user.value.avatar = data.data.avatar;
                        if (currentAdmin.value) currentAdmin.value.avatar = data.data.avatar;
                    }
                    if (data.data.name && currentAdmin.value) currentAdmin.value.name = data.data.name;
                    if (data.data.email && currentAdmin.value) currentAdmin.value.email = data.data.email;
                }
            } catch (e) { console.error('[Profile] Staff fetch failed:', e); }
        };

        const onFileSelected = async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                Swal.fire('Invalid File', 'Please select a valid image file (JPG, PNG, WebP).', 'warning');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire('File Too Large', 'Please select an image smaller than 5MB.', 'warning');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const b64 = ev.target.result;
                try {
                    const res = await fetch('../api/index.php?action=auth/upload_avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: user.value.username || 'admin', photoData: b64 })
                    });
                    const data = await res.json();
                    if (data.success && data.data) {
                        const newFilename = data.data.avatar || data.data.photo;
                        user.value.avatar = newFilename;
                        avatarFailed.value = false;
                        if (currentAdmin.value) currentAdmin.value.avatar = newFilename;
                        const raw = sessionStorage.getItem('gncp_admin_user');
                        if (raw) {
                            const p = JSON.parse(raw);
                            p.avatar = newFilename;
                            sessionStorage.setItem('gncp_admin_user', JSON.stringify(p));
                        }
                        const rawLoc = localStorage.getItem('gncp_admin_user');
                        if (rawLoc) {
                            const p = JSON.parse(rawLoc);
                            p.avatar = newFilename;
                            localStorage.setItem('gncp_admin_user', JSON.stringify(p));
                        }
                        notify(true, 'Profile picture updated successfully.');
                    } else {
                        Swal.fire('Upload Failed', data.message || 'Unable to update profile picture.', 'error');
                    }
                } catch (err) {
                    Swal.fire('Error', 'Unable to process image upload.', 'error');
                }
            };
            reader.readAsDataURL(file);
        };

        const saveStaffProfile = async () => {
            if (!user.value.name || !user.value.email) {
                Swal.fire('Validation Error', 'Full Name and Email Address are required.', 'warning');
                return;
            }
            saving.value = true;
            try {
                const avatarFilename = user.value.avatar ? user.value.avatar.split('/').pop() : null;
                const res = await fetch('../api/index.php?action=auth/update_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: user.value.username || 'admin',
                        name: user.value.name,
                        email: user.value.email,
                        avatar: avatarFilename
                    })
                });
                const data = await res.json();
                if (data.success) {
                    if (currentAdmin.value) {
                        currentAdmin.value.name = user.value.name;
                        currentAdmin.value.email = user.value.email;
                        currentAdmin.value.avatar = avatarFilename;
                    }
                    const raw = sessionStorage.getItem('gncp_admin_user');
                    if (raw) {
                        const p = JSON.parse(raw);
                        p.name = user.value.name;
                        p.email = user.value.email;
                        p.avatar = avatarFilename;
                        sessionStorage.setItem('gncp_admin_user', JSON.stringify(p));
                    }
                    const rawLoc = localStorage.getItem('gncp_admin_user');
                    if (rawLoc) {
                        const p = JSON.parse(rawLoc);
                        p.name = user.value.name;
                        p.email = user.value.email;
                        p.avatar = avatarFilename;
                        localStorage.setItem('gncp_admin_user', JSON.stringify(p));
                    }
                    notify(true, 'Personal details updated successfully.');
                } else {
                    Swal.fire('Update Failed', data.message || 'Unable to update profile.', 'error');
                }
            } catch (e) {
                Swal.fire('Error', 'Server error while saving profile.', 'error');
            } finally {
                saving.value = false;
            }
        };

        const updatePassword = async () => {
            if (!pass.value.current) {
                Swal.fire('Current Password Required', 'Please enter your current password.', 'warning');
                return;
            }
            if (pass.value.newPass !== pass.value.confirm) {
                Swal.fire('Password Mismatch', 'New password and confirm password do not match.', 'warning');
                return;
            }
            if (pass.value.newPass.length < 6) {
                Swal.fire('Weak Password', 'New password must be at least 6 characters.', 'warning');
                return;
            }
            updatingPass.value = true;
            try {
                const res = await fetch('../api/index.php?action=auth/change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: user.value.username || 'admin',
                        current_password: pass.value.current,
                        new_password: pass.value.newPass
                    })
                });
                const data = await res.json();
                if (data.success) {
                    pass.value = { current: '', newPass: '', confirm: '' };
                    passStrengthLevel.value = 0;
                    notify(true, 'Password changed successfully.');
                } else {
                    Swal.fire('Password Error', data.message || 'Unable to update password.', 'error');
                }
            } catch (e) {
                Swal.fire('Error', 'Server connection error while changing password.', 'error');
            } finally {
                updatingPass.value = false;
            }
        };

        watch(view, (newV) => {
            if (newV === 'profile') {
                loadProfile();
            }
        });

        return {
            currentAdmin, isLoggingIn, loginError, loginForm, showOperatorPassword,
            view, search, modal, form, operatorForm, isOperatorModalOpen, isEditOperatorModalOpen, isSubmittingOperator,
            successMsg, errorMsg,
            departments, programs, subjects, curriculum, periods, sections, classOfferings, fees, users, students,
            eyebrow, viewTitle, addLabel, searchPlaceholder,
            filteredDepartments, filteredPrograms, filteredSubjects, filteredCurriculum,
            filteredPeriods, filteredSections, filteredClassOfferings, filteredFees, filteredUsers, filteredSubjectsForSection,
            filteredProgramsList, filteredStudents, filteredAccounts, uniqueCurriculumVersionsForBulk,
            showLogoutConfirm, handleLogout, confirmLogout, setView, openAddModal, closeModal,
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
            // Announcements (Bulletin Board & Google Docs Editor)
            announcements, announcementForm, isSavingAnnouncement, uploadImgPreview,
            openAnnouncementModal, handleAnnouncementImageSelect, removeAnnouncementImage,
            saveAnnouncement, deleteAnnouncement, togglePinAnnouncement, fetchAdminAnnouncements,
            editorWordCount, editorCharCount, formatDoc, applyFormatBlock, applyTextColor,
            applyHiliteColor, insertLink, syncEditorContent, setImagePreset,
            // Academic Milestones Management
            milestones, milestoneForm, isSavingMilestone, openMilestoneModal, updateMilestoneDisplayDate,
            saveMilestone, deleteMilestone, fetchAdminMilestones,
            isMobileMenuOpen,
            // Sleek Course & Timeline Spline Chart
            chartViewMode, hoveredChartPoint, hoveredTimelinePoint, setHoveredPoint,
            getTooltipStyle, courseAnalytics, graphMetrics, timelineData, timelineGraphMetrics,
            // Profile & Security
            user, pass, saving, updatingPass, showCurrentPass, showNewPass, fileInput,
            initials, formattedAvatar, avatarFailed, onAvatarError,
            passStrengthLevel, passStrengthLabel, passStrengthColor, passStrengthWidth,
            checkPassStrength, triggerFileInput, onFileSelected, saveStaffProfile, updatePassword, loadProfile
        };
    }
});
window.app = app.mount('#admin-app');
