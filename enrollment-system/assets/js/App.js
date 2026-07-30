// Go-on National College of the Philippines — Enrollment UI Service
// Controller layer orchestrating wizard state, form submissions, and template actions
(function () {
    const createApp = Vue.createApp;
    const ref = Vue.ref;
    const reactive = Vue.reactive;
    const computed = Vue.computed;
    const watch = Vue.watch;

    const Model = window.EnrollmentModel;

    createApp({
        setup() {
            const urlParams = new URLSearchParams(window.location.search);
            const deptParam = urlParams.get('dept') || localStorage.getItem('gncp_selected_dept') || '';
            const hasDeptParam = urlParams.has('dept') || !!localStorage.getItem('gncp_selected_dept');
            const selectedCollege = ref('');

            const collegeSelectLabel = computed(() => {
                return hasDeptParam ? 'Select Department' : 'Select College';
            });

            const collegeSelectPlaceholder = computed(() => {
                return hasDeptParam ? 'Select Department' : 'Choose a department...';
            });

            // Steps Config — Step 7 is the confirmation screen (not shown in stepper)
            const steps = [
                { number: 1, title: 'Program & NSTP', icon: 'fas fa-university' },
                { number: 2, title: 'Personal Info',  icon: 'fas fa-user' },
                { number: 3, title: 'Academic Info',  icon: 'fas fa-graduation-cap' },
                { number: 4, title: 'Medical Info',   icon: 'fas fa-heartbeat' },
                { number: 5, title: 'Payment Term',   icon: 'fas fa-coins' },
                { number: 6, title: 'Review & Submit',icon: 'fas fa-check-double' }
            ];

            const currentStep = ref(1);

            // Async Submission & Account State
            const isSubmitting = ref(false);
            const submitError = ref('');
            const tempAccount = ref(null);
            const copiedField = ref('');
            const showPin = ref(false);
            const isLocalFile = ref(window.location.protocol === 'file:');

            // ── Form Fields State ──────────────────────────────────────────────────
            const form = reactive({
                // Step 1 — Program & NSTP
                studentType: 'FRESHMAN',
                educationPathway: 'REGULAR',
                courseCode: '',
                nstp: '',

                // Step 1 — Returning student verification
                existingStudentId: '',              // Official GNCP ID resolved after verification
                existingStudentIdentifier: '',       // Email entered by returnee for verification
                yearLevelApplied: '',               // Year level they are re-enrolling at
                returningStudentVerified: false,    // true after successful API lookup
                returningStudentData: null,         // Hydrated student record from the lookup API

                // Step 2 — Personal Info
                firstName: '',
                middleName: '',
                lastName: '',
                email: '',
                phone: '',
                birthDate: '',
                gender: '',
                address: '',

                // Step 3 — Academic Background
                elementarySchool: '',
                juniorHighSchool: '',
                seniorHighSchool: '',
                previousCollege: '',
                shsTrack: '',
                honors: '',

                // Step 4 — Medical Pre-Screening
                healthStatus: 'GOOD',          // GOOD | FAIR | POOR
                medicalConditions: [],
                allergies: '',
                currentMedication: false,
                medicationDetails: '',
                fitnessParticipation: true,
                emergencyContactName: '',
                emergencyContactPhone: '',

                // Step 5 — Payment
                paymentMode: 'CASH',           // CASH | SEMI | QUAD
                scholarship: 'NONE'            // NONE | HONOR | ATHLETIC | FINANCIAL
            });

            // ── Validation Errors State ────────────────────────────────────────────
            const errors = reactive({
                studentType: '',
                courseCode: '',
                nstp: '',
                existingStudentId: '',   // RETURNING: ID field validation
                yearLevelApplied: '',    // RETURNING: year level selection
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                birthDate: '',
                gender: '',
                address: '',
                elementarySchool: '',
                juniorHighSchool: '',
                seniorHighSchool: '',
                previousCollege: '',
                emergencyContactName: '',
                emergencyContactPhone: ''
            });

            // ── Returning Student Lookup State ────────────────────────────────────────
            const isLookingUp   = Vue.ref(false);  // Spinner flag for Verify button
            const lookupError   = Vue.ref('');     // Error message from failed lookup
            const lookupSuccess = Vue.ref(false);  // true = show green confirmation banner

            // ── Draft Persistence Logic ────────────────────────────────────────────
            const saveDraft = () => {
                const draft = {
                    currentStep: currentStep.value,
                    form: form
                };
                localStorage.setItem('gncp_enrollment_draft', JSON.stringify(draft));
            };

            const loadDraft = () => {
                const stored = localStorage.getItem('gncp_enrollment_draft');
                if (stored) {
                    try {
                        const draft = JSON.parse(stored);
                        if (draft.currentStep && draft.currentStep < 7) {
                            currentStep.value = draft.currentStep;
                            for (const key in draft.form) {
                                if (draft.form.hasOwnProperty(key)) {
                                    form[key] = draft.form[key];
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to restore draft:', e);
                    }
                }
            };

            // Restore from draft before registering watchers
            loadDraft();

            // Watch state changes to auto-save draft
            watch(currentStep, saveDraft);
            watch(form, saveDraft, { deep: true });

            // ── Option Catalogs (Delegated to Model) ───────────────────────────────
            const colleges = ref(Model.getColleges());
            const courses = ref(Model.getCourses());
            const activePeriodInfo = ref(null);
            const programsLoadError = ref('');

            const fetchActivePrograms = () => {
                window.ApiService.getActivePrograms()
                    .then(res => {
                        if (res.success && res.data) {
                            if (res.data.programs && res.data.programs.length > 0) {
                                Model.setPrograms(res.data.programs);
                                colleges.value = Model.getColleges();
                                courses.value = Model.getCourses();
                                
                                // Restore selectedCollege from draft courseCode if exists
                                if (form.courseCode) {
                                    const matchedCourse = courses.value.find(c => c.code === form.courseCode);
                                    if (matchedCourse) {
                                        selectedCollege.value = matchedCourse.college;
                                    }
                                } else {
                                    // Otherwise restore from URL parameter or localStorage
                                    const matchedDept = ['COIT', 'COBA', 'COHS'].includes(deptParam.toUpperCase()) ? deptParam.toUpperCase() : '';
                                    if (matchedDept) {
                                        selectedCollege.value = matchedDept;
                                    }
                                }
                            }
                            if (res.data.activePeriod) {
                                activePeriodInfo.value = res.data.activePeriod;
                            } else {
                                programsLoadError.value = 'Enrollment is currently closed. No active academic period is configured.';
                            }
                        } else {
                            programsLoadError.value = res.error || 'Failed to fetch active programs.';
                        }
                    })
                    .catch(err => {
                        console.error('Failed to load active programs:', err);
                        programsLoadError.value = 'Failed to connect to server for active programs.';
                    });
            };

            fetchActivePrograms();

            const admissionTypes = Model.getAdmissionTypes();
            const nstpOptions = Model.getNstpOptions();
            const paymentModes = Model.getPaymentModes();
            const medicalConditionOptions = Model.getMedicalConditionOptions();



            // Calculate yesterday's date as the maximum birth date allowed
            const maxBirthDate = computed(() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yyyy = yesterday.getFullYear();
                
                let mm = yesterday.getMonth() + 1;
                if (mm < 10) {
                    mm = '0' + mm;
                }
                
                let dd = yesterday.getDate();
                if (dd < 10) {
                    dd = '0' + dd;
                }
                
                return yyyy + '-' + mm + '-' + dd;
            });

            const filteredCourses = computed(() => {
                if (!selectedCollege.value) return [];
                const result = [];
                for (let i = 0; i < courses.value.length; i++) {
                    if (courses.value[i].college === selectedCollege.value) {
                        result.push(courses.value[i]);
                    }
                }
                return result;
            });

            const onCollegeChange = () => {
                form.courseCode = '';
            };

            const onPathwayChange = () => {
                form.juniorHighSchool = '';
                form.seniorHighSchool = '';
                form.shsTrack = '';
                errors.juniorHighSchool = '';
                errors.seniorHighSchool = '';
            };

            // ── Returning Student: Lookup & Pre-fill ────────────────────────────────
            const lookupReturningStudent = () => {
                const identifier = (form.existingStudentIdentifier || '').trim();
                if (!identifier) {
                    lookupError.value = 'Please enter your email address before verifying.';
                    return;
                }

                // Basic client-side email format check
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
                    lookupError.value = 'Please enter a valid email address (e.g. juan.delacruz@gncp.edu.ph).';
                    return;
                }

                isLookingUp.value             = true;
                lookupError.value             = '';
                lookupSuccess.value           = false;
                form.returningStudentVerified = false;
                form.returningStudentData     = null;

                window.ApiService.lookupReturningStudent(identifier)
                    .then(res => {
                        isLookingUp.value = false;
                        if (res.success && res.data) {
                            form.returningStudentVerified = true;
                            form.returningStudentData     = res.data;
                            form.existingStudentId        = res.data.id;
                            lookupSuccess.value           = true;

                            form.firstName  = res.data.firstName  || '';
                            form.middleName = res.data.middleName || '';
                            form.lastName   = res.data.lastName   || '';
                            form.email      = res.data.email      || '';

                            const rawPhone = res.data.phone || '';
                            form.phone = rawPhone.startsWith('09') ? rawPhone.slice(2) : rawPhone;

                            form.birthDate = res.data.birthDate || '';
                            form.gender    = res.data.gender    || '';
                            form.address   = res.data.address   || '';

                            if (res.data.year_level && !form.yearLevelApplied) {
                                form.yearLevelApplied = res.data.year_level;
                            }

                            errors.existingStudentId = '';
                            errors.yearLevelApplied  = '';
                        } else {
                            lookupError.value = res.error || 'Verification failed. Please check your email and try again.';
                        }
                    })
                    .catch(err => {
                        isLookingUp.value = false;
                        console.error('[App] Returning student lookup failed:', err);
                        lookupError.value = 'An unexpected error occurred. Please try again.';
                    });
            };

            // Reset verification state whenever the email identifier field is edited
            watch(() => form.existingStudentIdentifier, (newVal, oldVal) => {
                if (newVal !== oldVal && form.returningStudentVerified) {
                    form.returningStudentVerified = false;
                    form.returningStudentData     = null;
                    lookupSuccess.value           = false;
                }
            });


            const toggleCondition = (condition) => {
                const idx = form.medicalConditions.indexOf(condition);
                if (idx === -1) {
                    form.medicalConditions.push(condition);
                } else {
                    form.medicalConditions.splice(idx, 1);
                }
            };

            // ── Dynamic Pricing calculations (Delegated to Model) ──────────────────
            const fees = computed(() => {
                return Model.calculateFees(form);
            });
            const calcTuition = computed(() => fees.value.tuition);
            const calcMisc = computed(() => fees.value.misc);
            const calcDiscount = computed(() => fees.value.discount);
            const calcCashDiscount = computed(() => fees.value.cashDiscount);
            const calcTotal = computed(() => fees.value.total);
            const calcDownpayment = computed(() => fees.value.downpayment);
            const calcInstallmentAmount = computed(() => fees.value.installmentAmount);

            // ── Requirement Matrix (Delegated to Model) ───────────────────────────
            const getRequirements = computed(() => {
                return Model.getRequirements(form.studentType, form.educationPathway);
            });

            // ── Step Validation (Delegated to Model) ───────────────────────────────
            const validateCurrentStep = () => {
                if (currentStep.value === 3) {
                    if (form.educationPathway === 'ALS') {
                        if (!form.juniorHighSchool || !form.juniorHighSchool.trim()) {
                            form.juniorHighSchool = 'N/A (ALS)';
                        }
                        if (!form.seniorHighSchool || !form.seniorHighSchool.trim()) {
                            form.seniorHighSchool = 'Alternative Learning System (ALS)';
                        }
                        if (!form.shsTrack || !form.shsTrack.trim()) {
                            form.shsTrack = 'ALS';
                        }
                    } else if (form.educationPathway === 'OLD_CURRICULUM') {
                        if (!form.seniorHighSchool || !form.seniorHighSchool.trim()) {
                            form.seniorHighSchool = 'N/A (Old Curriculum)';
                        }
                        if (!form.shsTrack || !form.shsTrack.trim()) {
                            form.shsTrack = 'OLD_CURRICULUM';
                        }
                    }
                }
                return Model.validateStep(currentStep.value, form, errors);
            };

            const nextStep = () => {
                if (!validateCurrentStep()) {
                    setTimeout(() => {
                        const firstErrorEl = document.querySelector('.is-invalid, .text-danger');
                        if (firstErrorEl) {
                            firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 100);
                    return;
                }

                // On Step 6 (Review & Submit), trigger backend API registration via standard Promise .then()
                if (currentStep.value === 6) {
                    isSubmitting.value = true;
                    submitError.value = '';

                    // Clone form data and prefix the phone numbers with '09' for storage
                    const payload = JSON.parse(JSON.stringify(form));
                    payload.phone = '09' + form.phone;
                    payload.emergencyContactPhone = '09' + form.emergencyContactPhone;

                    window.ApiService.submitEnrollment(payload)
                        .then(res => {
                            isSubmitting.value = false;
                            if (res.success) {
                                localStorage.removeItem('gncp_enrollment_draft');
                                tempAccount.value = res.data;
                                currentStep.value = 7; // Advance to confirmation screen
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else {
                                submitError.value = res.error || 'Failed to submit registration.';
                            }
                        })
                        .catch(err => {
                            isSubmitting.value = false;
                            console.error('Submit execution error:', err);
                            submitError.value = 'An unexpected error occurred. Please try again.';
                        });
                } else if (currentStep.value < 6) {
                    currentStep.value++;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };

            const prevStep = () => {
                if (currentStep.value > 1 && currentStep.value <= 6) {
                    currentStep.value--;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };

            const copyToClipboard = (text, fieldName) => {
                navigator.clipboard.writeText(text).then(() => {
                    copiedField.value = fieldName;
                    setTimeout(() => { copiedField.value = ''; }, 2000);
                }).catch(err => {
                    console.error('Copy failed:', err);
                });
            };

            // Expose view formatting helpers directly from Model
            const formatPrice = Model.formatPrice;
            const getCourseName = Model.getCourseName;
            const getNstpLabel = Model.getNstpLabel;
            const getStudentTypeLabel = Model.getStudentTypeLabel;
            const getPaymentModeLabel = Model.getPaymentModeLabel;
            const getScholarshipLabel = Model.getScholarshipLabel;

            return {
                steps,
                currentStep,
                isSubmitting,
                submitError,
                tempAccount,
                copiedField,
                showPin,
                form,
                colleges,
                courses,
                admissionTypes,
                nstpOptions,
                paymentModes,
                medicalConditionOptions,
                selectedCollege,
                collegeSelectLabel,
                collegeSelectPlaceholder,
                filteredCourses,
                onCollegeChange,
                onPathwayChange,
                lookupReturningStudent,
                isLookingUp,
                lookupError,
                lookupSuccess,
                toggleCondition,
                calcTuition,
                calcMisc,
                calcDiscount,
                calcCashDiscount,
                calcTotal,
                calcDownpayment,
                calcInstallmentAmount,
                getRequirements,
                errors,
                validateCurrentStep,
                nextStep,
                prevStep,
                copyToClipboard,
                formatPrice,
                getCourseName,
                getNstpLabel,
                getStudentTypeLabel,
                getPaymentModeLabel,
                getScholarshipLabel,
                maxBirthDate,
                isLocalFile,
                activePeriodInfo,
                programsLoadError
            };
        }
    }).mount('#enrollment-app');
})();
