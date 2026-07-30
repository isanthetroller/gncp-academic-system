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
        const receiptData = ref(null);

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
            const queue = StationDataBus.getQueue();
            const result = [];
            for (let i = 0; i < queue.length; i++) {
                const student = queue[i];
                // Enforce sequential station workflow
                const step = student.roadmap ? student.roadmap.find(r => r.stepId === 'cashier_payment') : null;
                if (!step || step.status === 'PENDING') {
                    continue;
                }
                
                let balanceVal = student.payment.totalFee || 0;
                if (student.payment.balance != null) {
                    balanceVal = student.payment.balance;
                }

                const s = {
                    referenceNumber: student.referenceNumber,
                    tempPin: student.tempPin || '',
                    studentName: student.name,
                    program: student.program,
                    studentType: student.studentType,
                    status: student.payment.status || 'PENDING',
                    orNumber: student.orNumber || null,
                    enrolledAt: student.enrolledAt || null,
                    cashierName: student.cashierName || null,
                    payment: {
                        totalFee:       student.payment.totalFee     || 0,
                        amountPaid:     student.payment.amountPaid   || 0,
                        balance:        balanceVal,
                        paymentType:    student.payment.paymentType  || 'Cash',
                        transactionRef: student.payment.transactionRef || '',
                        cashierNotes:   student.payment.notes        || '',
                        history:        student.payment.history      || []
                    },
                    roadmap: student.roadmap,
                    scholarship: student.scholarship || {},
                    helpdesk: student.helpdesk || {}
                };
                result.push(s);
            }
            students.value = result;
        };

        const checkSession = () => {
            const stored = sessionStorage.getItem('gncp_station_user') || sessionStorage.getItem('gncp_admin_user');
            if (stored) {
                const user = JSON.parse(stored);
                if (user.role === 'CASHIER' || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'REGISTRAR') {
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

        const filteredStudents = computed(() => {
            const query = searchQuery.value.toLowerCase().trim();
            const result = [];
            for (let i = 0; i < students.value.length; i++) {
                const student = students.value[i];

                let matchesQuery = true;
                if (query) {
                    const matchesRef = student.referenceNumber.toLowerCase().indexOf(query) !== -1;
                    const matchesName = student.studentName.toLowerCase().indexOf(query) !== -1;
                    const matchesProg = student.program.toLowerCase().indexOf(query) !== -1;
                    const matchesType = student.payment.paymentType.toLowerCase().indexOf(query) !== -1;
                    matchesQuery = matchesRef || matchesName || matchesProg || matchesType;
                }

                let matchesFilter = false;
                if (activeFilter.value === 'All') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'PENDING' && student.status === 'PENDING') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'PAID' && student.status === 'PAID') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'PARTIAL' && student.status === 'PARTIAL') {
                    matchesFilter = true;
                } else if (activeFilter.value === 'REJECTED' && student.status === 'REJECTED') {
                    matchesFilter = true;
                }

                if (matchesQuery && matchesFilter) {
                    result.push(student);
                }
            }

            // Registrar Sorting Logic
            return [...result].sort((a, b) => {
                let vA = (sortBy.value === 'studentName' || sortBy.value === 'name') ? a.studentName : (a[sortBy.value] || '');
                let vB = (sortBy.value === 'studentName' || sortBy.value === 'name') ? b.studentName : (b[sortBy.value] || '');
                if (typeof vA === 'string') vA = vA.toLowerCase();
                if (typeof vB === 'string') vB = vB.toLowerCase();
                if (vA < vB) return sortDesc.value ? 1 : -1;
                if (vA > vB) return sortDesc.value ? -1 : 1;
                return 0;
            });
        });

        const totalInQueue = computed(() => {
            return students.value.length;
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

        const paidToday = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'PAID') {
                    count++;
                }
            }
            return count;
        });

        const partialCount = computed(() => {
            let count = 0;
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'PARTIAL') {
                    count++;
                }
            }
            return count;
        });

        const paymentPercent = computed(() => {
            if (students.value.length === 0) return 0;
            const completed = paidToday.value + partialCount.value;
            return Math.round((completed / students.value.length) * 100);
        });

        const recentTransactions = computed(() => {
            const list = [];
            for (let i = 0; i < students.value.length; i++) {
                if (students.value[i].status === 'PAID' || students.value[i].status === 'PARTIAL') {
                    list.push(students.value[i]);
                }
            }
            return list;
        });

        const billingDetails = computed(() => {
            const student = selectedStudent.value;
            if (!student) {
                return {
                    totalFees: 0,
                    scholarshipDiscount: 0,
                    grandTotal: 0
                };
            }
            const totalFees = student.payment.totalFee || 0;
            const amountPaid = student.payment.amountPaid || 0;
            const balance = student.payment.balance || 0;
            const scholarshipDiscount = Math.max(0, totalFees - (amountPaid + balance));
            const grandTotal = totalFees - scholarshipDiscount;
            return {
                totalFees,
                scholarshipDiscount,
                grandTotal
            };
        });

        const setView = (view) => {
            currentView.value = view;
        };

        const payAmountInput = ref(0);
        const cashTendered = ref(0);

        const changeDue = computed(() => {
            if (cashTendered.value <= 0 || payAmountInput.value <= 0) return 0;
            return Math.max(0, cashTendered.value - payAmountInput.value);
        });

        const newBalance = computed(() => {
            if (!selectedStudent.value) return 0;
            return Math.max(0, selectedStudent.value.payment.balance - payAmountInput.value);
        });

        const openProcess = (student) => {
            selectedStudent.value = student;
            payAmountInput.value = student.payment.balance || 0; // Default to full outstanding balance
            cashTendered.value = 0;
            setTimeout(() => {
                const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentModal'));
                modal.show();
            }, 0);
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

        const persistPayment = (student) => {
            StationDataBus.updateStudent(student.referenceNumber, (s) => {
                s.payment.status         = student.status;
                s.payment.amountPaid     = student.payment.amountPaid;
                s.payment.balance        = student.payment.balance;
                s.payment.paymentType    = student.payment.paymentType;
                s.payment.transactionRef = student.payment.transactionRef;
                s.payment.notes          = student.payment.cashierNotes;

                // Set database verification logs
                s.payment.verifiedBy = currentUser.value.name;
                s.payment.dateVerified = new Date().toLocaleDateString();

                // Mark cashier step as completed; advance IT Center step to IN_PROGRESS
                const currentStepIdx = s.roadmap.findIndex(r => r.stepId === 'cashier_payment');
                if (currentStepIdx !== -1) {
                    if (student.status === 'PAID' || student.status === 'PARTIAL') {
                        s.roadmap[currentStepIdx].status = 'COMPLETED';
                        s.roadmap[currentStepIdx].updatedAt = new Date().toISOString();

                        // Unlock the IT Center step
                        const nextStep = s.roadmap.slice(currentStepIdx + 1).find(r => r.status === 'PENDING');
                        if (nextStep) {
                            nextStep.status = 'IN_PROGRESS';
                        }
                    } else if (student.status === 'REJECTED') {
                        s.roadmap[currentStepIdx].status = 'FLAGGED';
                    }
                }
            });
            loadQueue();
        };

        const recordPayment = async () => {
            if (!selectedStudent.value) return;
            const student = selectedStudent.value;
            const payAmt = parseFloat(payAmountInput.value) || 0;

            if (payAmt <= 0) {
                await Swal.fire({
                    title: 'Invalid Amount',
                    text: 'Please enter a valid payment amount greater than 0.',
                    icon: 'warning',
                    confirmButtonColor: '#0d6efd'
                });
                return;
            }
            if (payAmt > student.payment.balance) {
                await Swal.fire({
                    title: 'Excess Amount',
                    text: 'Payment amount cannot exceed the outstanding balance of ₱' + student.payment.balance.toLocaleString() + '.',
                    icon: 'warning',
                    confirmButtonColor: '#0d6efd'
                });
                return;
            }
            if (student.payment.paymentType === 'Cash' && cashTendered.value < payAmt) {
                await Swal.fire({
                    title: 'Insufficient Cash',
                    text: 'Cash tendered (₱' + cashTendered.value.toLocaleString() + ') is less than the payment amount (₱' + payAmt.toLocaleString() + ').',
                    icon: 'warning',
                    confirmButtonColor: '#0d6efd'
                });
                return;
            }
            const isFull = (student.payment.balance - payAmt) === 0;
            student.status = isFull ? 'PAID' : 'PARTIAL';

            if (!student.payment.transactionRef) {
                student.payment.transactionRef = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
            }

            const transactionRef = student.payment.transactionRef;
            const paymentType = student.payment.paymentType;
            const notes = student.payment.cashierNotes;

            StationDataBus.updateStudent(student.referenceNumber, (s) => {
                s.payment.status         = student.status;
                s.payment.amountPaid     = (s.payment.amountPaid || 0) + payAmt;
                s.payment.balance        = (s.payment.balance || 0) - payAmt;
                s.payment.paymentType    = paymentType;
                s.payment.transactionRef = transactionRef;
                s.payment.notes          = notes;
                s.payment.verifiedBy     = currentUser.value.name;
                s.payment.dateVerified   = new Date().toLocaleDateString();

                if (!s.payment.history || !Array.isArray(s.payment.history)) {
                    s.payment.history = [];
                }

                s.payment.history.push({
                    date: new Date().toISOString(),
                    amount: payAmt,
                    reference: transactionRef,
                    paymentType: paymentType,
                    cashier: currentUser.value.name,
                    notes: notes
                });

                const currentStepIdx = (s.roadmap && Array.isArray(s.roadmap)) ? s.roadmap.findIndex(r => r.stepId === 'cashier_payment') : -1;
                if (currentStepIdx !== -1) {
                    s.roadmap[currentStepIdx].status = 'COMPLETED';
                    s.roadmap[currentStepIdx].updatedAt = new Date().toISOString();

                    const nextStep = s.roadmap.slice(currentStepIdx + 1).find(r => r.status === 'PENDING');
                    if (nextStep) {
                        nextStep.status = 'IN_PROGRESS';
                    }
                }
            });

            loadQueue();
            closeModal();

            receiptData.value = {
                refNo: student.referenceNumber,
                name: student.studentName,
                program: student.program,
                paymentMode: paymentType,
                transactionRef: transactionRef,
                totalFee: student.payment.totalFee,
                amountPaid: payAmt,
                balance: student.payment.balance - payAmt,
                date: new Date().toLocaleString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                }),
                cashier: currentUser.value?.name || 'Cashier Officer'
            };
        };

        const printCOR = (student) => {
            const url = `cor_print.php?ref=${student.referenceNumber}&pin=${student.tempPin}`;
            window.open(url, '_blank');
        };

        const markEnrolledAndPrint = async (student) => {
            try {
                const res = await fetch('../backend/generate_or.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        referenceNumber: student.referenceNumber,
                        cashierName: currentUser.value ? currentUser.value.name : 'Cashier Representative'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    student.orNumber = data.data.orNumber;
                    student.enrolledAt = data.data.enrolledAt;
                    student.cashierName = currentUser.value ? currentUser.value.name : 'Cashier Representative';

                    StationDataBus.updateStudent(student.referenceNumber, (s) => {
                        s.orNumber = data.data.orNumber;
                        s.enrolledAt = data.data.enrolledAt;
                        s.cashierName = currentUser.value ? currentUser.value.name : 'Cashier Representative';
                        s.payment.status = student.status;
                        
                        const currentStepIdx = s.roadmap.findIndex(r => r.stepId === 'cashier_payment');
                        if (currentStepIdx !== -1) {
                            if (s.roadmap[currentStepIdx].status === 'COMPLETED') {
                                return;
                            }
                            s.roadmap[currentStepIdx].status = 'COMPLETED';
                            s.roadmap[currentStepIdx].updatedAt = new Date().toISOString();

                            const nextStep = s.roadmap.slice(currentStepIdx + 1).find(r => r.status === 'PENDING');
                            if (nextStep) {
                                nextStep.status = 'IN_PROGRESS';
                            }
                        }
                    });

                    window.open(`receipt_print.php?ref=${student.referenceNumber}&autoprint=true`, '_blank');
                    loadQueue();
                } else {
                    await Swal.fire({
                        title: 'Error',
                        text: 'Error generating OR: ' + (data.message || 'Unknown error'),
                        icon: 'error',
                        confirmButtonColor: '#0d6efd'
                    });
                }
            } catch (err) {
                console.error('OR Generation error:', err);
                await Swal.fire({
                    title: 'Error',
                    text: 'Connection error occurred while generating Official Receipt.',
                    icon: 'error',
                    confirmButtonColor: '#0d6efd'
                });
            }
        };

        const confirmFullPayment = () => {
            if (!selectedStudent.value) return;
            payAmountInput.value = selectedStudent.value.payment.balance || 0;
            cashTendered.value = payAmountInput.value;
            recordPayment();
        };

        const recordDownPayment = (amount) => {
            if (!selectedStudent.value) return;
            payAmountInput.value = amount || 0;
            cashTendered.value = payAmountInput.value;
            recordPayment();
        };

        const rejectPayment = () => {
            if (!selectedStudent.value) return;
            const student = selectedStudent.value;
            
            const netAssessment = student.payment.amountPaid + student.payment.balance;

            student.status = 'REJECTED';
            student.payment.balance = netAssessment;
            student.payment.amountPaid = 0;

            if (!student.payment.transactionRef) {
                student.payment.transactionRef = 'RJ-' + student.referenceNumber.substring(student.referenceNumber.length - 4);
            }
            persistPayment(student);
            closeModal();
        };

        const printReceipt = () => {
            window.print();
        };

        const closeReceipt = () => {
            receiptData.value = null;
        };

        const closeModal = () => {
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('paymentModal'));
            modal.hide();
            selectedStudent.value = null;
        };

        const getStatusClass = (status) => {
            return status.toLowerCase().replace(/\s+/g, '-');
        };

        const formatCurrency = (value) => {
            return Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
            totalInQueue,
            pendingCount,
            paidToday,
            partialCount,
            paymentPercent,
            recentTransactions,
            billingDetails,
            setView,
            openProcess,
            getStepIcon,
            confirmFullPayment,
            recordDownPayment,
            rejectPayment,
            closeModal,
            getStatusClass,
            formatCurrency,
            formatStatus,
            getStatusBadgeClass,
            currentUser,
            isLoggingIn,
            loginError,
            loginForm,
            handleLogout,
            showLogoutConfirm,
            confirmLogout,
            receiptData,
            printReceipt,
            closeReceipt,
            payAmountInput,
            cashTendered,
            changeDue,
            newBalance,
            recordPayment,
            printCOR,
            markEnrolledAndPrint
        };
    }
}).mount('#app');
