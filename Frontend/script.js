let selectedMovie = null;
let selectedCity = null;
let selectedTheater = null;
let selectedShow = null;
let selectedSeats = [];
let movies = [];
let cities = [];
let theaters = [];
let shows = [];
let seats = [];

const api = "http://localhost:8080/api";
const ticketPrice = 200;

// User data for payment
let currentUser = {
    userId: 1,
    name: "Guest User",
    email: "guest@easybook.com",
    phone: "9999999999"
};

function getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
}

function loadUserDetails() {
    const user = getCurrentUser();
    if (user) {
        console.log("User loaded:", user);
    } else {
        console.warn("No user found in localStorage");
    }
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    console.log('DOM Content Loaded - Starting initialization');
    
    // Load user details from localStorage
    try {
        loadUserDetails();
        console.log('User details loaded successfully');
    } catch (error) {
        console.error('Error loading user details:', error);
    }
    
    if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => console.log('Razorpay script loaded');
        script.onerror = () => console.error('Failed to load Razorpay script');
        document.head.appendChild(script);
    }
    
    try {
        await loadMovies();
        console.log('Movies loaded successfully');
    } catch (error) {
        console.error('Error loading movies:', error);
    }
    
    try {
        initializeUIEnhancements();
        console.log('UI enhancements initialized');
    } catch (error) {
        console.error('Error initializing UI enhancements:', error);
    }
    
    try {
        const savedProgress = loadBookingProgress();
        if (savedProgress && savedProgress.selectedMovie) {
            if (confirm('You have an incomplete booking. Would you like to continue where you left off?')) {
                await restoreBookingProgress(savedProgress);
            } else {
                clearBookingProgress();
            }
        }
    } catch (error) {
        console.error('Error with booking progress:', error);
    }
    
    console.log('EasyBook initialized successfully');
});

// API helper function
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("Error fetching:", url, err);
        throw err;
    }
}

// Load and display movies
async function loadMovies() {
    try {
        movies = await fetchData(`${api}/movies`);
        displayMovies(movies);
    } catch (error) {
        console.error("Failed to load movies:", error);
        document.getElementById("moviesGrid").innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545; grid-column: 1/-1;">
                <h3>Unable to load movies</h3>
                <p>Please check if the backend server is running on http://localhost:8080</p>
                <button class="btn btn-primary" onclick="loadMovies()" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    }
}

function displayMovies(moviesToShow) {
    const moviesGrid = document.getElementById("moviesGrid");
    moviesGrid.innerHTML = "";
    
    if (!moviesToShow || moviesToShow.length === 0) {
        moviesGrid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1/-1;">
                <h3>No movies found</h3>
                <p>Please try again later</p>
            </div>
        `;
        return;
    }
    
    moviesToShow.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card fade-in';
        card.onclick = () => selectMovie(movie);
        card.innerHTML = `
            <div class="movie-poster"></div>
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p><strong>Genre:</strong> ${movie.gener || movie.genre}</p>
                <p><strong>Language:</strong> ${movie.lang}</p>
                <p><strong>Duration:</strong> ${movie.duration} mins</p>
            </div>
        `;
        moviesGrid.appendChild(card);
    });
}

// Movie selection
function selectMovie(movie) {
    selectedMovie = movie;
    
    document.querySelectorAll('.movie-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show booking flow and load cities for selected movie
    document.getElementById('bookingFlow').style.display = 'block';
    loadCitiesForMovie(movie.movieId);
    
    // Reset subsequent steps
    resetBookingFlow();
    
    // Smooth scroll to booking section
    document.getElementById('bookingFlow').scrollIntoView({ behavior: 'smooth' });
}

// Load cities for selected movie
async function loadCitiesForMovie(movieId) {
    try {
        cities = await fetchData(`${api}/cities/${movieId}`);
        displayCities(cities);
        document.getElementById("cityStep").classList.remove('hidden');
    } catch (error) {
        console.error("Failed to load cities:", error);
        document.getElementById("citiesGrid").innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545; grid-column: 1/-1;">
                <h3>Error loading cities</h3>
                <p>Please try again</p>
                <button class="btn btn-primary" onclick="loadCitiesForMovie(${movieId})" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    }
}

function displayCities(cities) {
    const citiesGrid = document.getElementById("citiesGrid");
    citiesGrid.innerHTML = "";
    
    if (cities.length === 0) {
        citiesGrid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1/-1;">
                <p>No cities available for this movie</p>
            </div>
        `;
        return;
    }
    
    cities.forEach(city => {
        const cityElement = document.createElement('div');
        cityElement.className = 'selection-item fade-in';
        cityElement.textContent = city;
        cityElement.onclick = () => selectCity(city);
        citiesGrid.appendChild(cityElement);
    });
}

// City selection
function selectCity(city) {
    selectedCity = city;
    
    // Update UI
    document.querySelectorAll('#citiesGrid .selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Load theaters
    loadTheatersForCity(selectedMovie.movieId, city);
}

// Load theaters for selected city
async function loadTheatersForCity(movieId, city) {
    try {
        theaters = await fetchData(`${api}/theaters/${movieId}/${encodeURIComponent(city)}`);
        displayTheaters(theaters);
        document.getElementById("theaterStep").classList.remove('hidden');
        document.getElementById("theaterStep").scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error("Failed to load theaters:", error);
        document.getElementById("theatersGrid").innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545; grid-column: 1/-1;">
                <h3>Error loading theaters</h3>
                <p>Please try again</p>
                <button class="btn btn-primary" onclick="loadTheatersForCity(${movieId}, '${city}')" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    }
}

function displayTheaters(theaters) {
    const theatersGrid = document.getElementById("theatersGrid");
    theatersGrid.innerHTML = "";
    
    if (theaters.length === 0) {
        theatersGrid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1/-1;">
                <p>No theaters available in this city</p>
            </div>
        `;
        return;
    }
    
    theaters.forEach(theater => {
        const theaterElement = document.createElement('div');
        theaterElement.className = 'selection-item fade-in';
        theaterElement.innerHTML = `
            <h4>${theater.name}</h4>
            <p>${theater.city}</p>
        `;
        theaterElement.onclick = () => selectTheater(theater);
        theatersGrid.appendChild(theaterElement);
    });
}

// Theater selection
function selectTheater(theater) {
    selectedTheater = theater;
    
    // Update UI
    document.querySelectorAll('#theatersGrid .selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Load shows
    loadShowsForTheater(selectedMovie.movieId, theater.theaterId);
}

// Load shows for selected theater
async function loadShowsForTheater(movieId, theaterId) {
    try {
        shows = await fetchData(`${api}/shows/${movieId}/${theaterId}`);
        displayShows(shows);
        document.getElementById("showStep").classList.remove('hidden');
        document.getElementById("showStep").scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error("Failed to load shows:", error);
        document.getElementById("showsGrid").innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545; grid-column: 1/-1;">
                <h3>Error loading shows</h3>
                <p>Please try again</p>
                <button class="btn btn-primary" onclick="loadShowsForTheater(${movieId}, ${theaterId})" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    }
}

function displayShows(shows) {
    const showsGrid = document.getElementById("showsGrid");
    showsGrid.innerHTML = "";
    
    if (shows.length === 0) {
        showsGrid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1/-1;">
                <p>No shows available for this theater</p>
            </div>
        `;
        return;
    }
    
    shows.forEach(show => {
        const showElement = document.createElement('div');
        showElement.className = 'selection-item fade-in';
        showElement.innerHTML = `
            <h4>${show.showTime || show.timing || show.time}</h4>
        `;
        showElement.onclick = () => selectShow(show);
        showsGrid.appendChild(showElement);
    });
}

// Show selection
function selectShow(show) {
    selectedShow = show;
    
    // Update UI
    document.querySelectorAll('#showsGrid .selection-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Load seats
    loadSeatsForShow(show.showId);
}

// Load seats for selected show
async function loadSeatsForShow(showId) {
    try {
        seats = await fetchData(`${api}/seats/${showId}`);
        displaySeats(seats);
        document.getElementById("seatStep").classList.remove('hidden');
        document.getElementById("seatStep").scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error("Failed to load seats:", error);
        document.getElementById("seatsContainer").innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #dc3545; grid-column: 1/-1;">
                <h3>Error loading seats</h3>
                <p>Please try again</p>
                <button class="btn btn-primary" onclick="loadSeatsForShow(${showId})" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
    }
}

function displaySeats(seats) {
    const seatsContainer = document.getElementById("seatsContainer");
    seatsContainer.innerHTML = "";
    
    if (!seats || seats.length === 0) {
        seatsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1/-1;">
                <p>No seats available for this show</p>
            </div>
        `;
        return;
    }
    
    // Sort seats by seat number for proper display
    seats.sort((a, b) => a.seatNumber - b.seatNumber);
    
    seats.forEach(seat => {
        const seatElement = document.createElement('div');
        seatElement.className = 'seat fade-in';
        seatElement.textContent = seat.seatNumber;
        seatElement.dataset.seatId = seat.seatId;
        seatElement.dataset.seatNumber = seat.seatNumber;
        
        if (seat.isBooked || seat.booked) {
            seatElement.classList.add('occupied');
            seatElement.title = 'Already booked';
        } else {
            seatElement.classList.add('available');
            seatElement.onclick = () => toggleSeat(seatElement, seat.seatId, seat.seatNumber);
            seatElement.title = `Seat ${seat.seatNumber} - Available`;
        }
        
        seatsContainer.appendChild(seatElement);
    });
    
    updateBookingSummary();
}

// Toggle seat selection
function toggleSeat(seatElement, seatId, seatNumber) {
    if (seatElement.classList.contains('occupied')) return;
    
    if (seatElement.classList.contains('selected')) {
        seatElement.classList.remove('selected');
        seatElement.classList.add('available');
        selectedSeats = selectedSeats.filter(s => s.seatId !== seatId);
    } else {
        seatElement.classList.remove('available');
        seatElement.classList.add('selected');
        selectedSeats.push({ seatId: seatId, seatNumber: seatNumber });
    }
    
    updateBookingSummary();
    updateBookingButton();
}

// Update booking summary
function updateBookingSummary() {
    const summaryElement = document.getElementById("bookingSummary");
    
    if (selectedSeats.length > 0) {
        summaryElement.classList.remove('hidden');
        
        document.getElementById("summaryMovie").textContent = selectedMovie ? selectedMovie.title : '-';
        document.getElementById("summaryTheater").textContent = selectedTheater ? selectedTheater.name : '-';
        document.getElementById("summaryShow").textContent = selectedShow ? (selectedShow.showTime || selectedShow.timing || selectedShow.time) : '-';
        
        const seatNumbers = selectedSeats.map(s => s.seatNumber).sort((a, b) => a - b);
        document.getElementById("summarySeats").textContent = seatNumbers.join(', ');
        document.getElementById("totalPrice").textContent = selectedSeats.length * ticketPrice;
    } else {
        summaryElement.classList.add('hidden');
    }
}

// Update booking button state
function updateBookingButton() {
    const bookBtn = document.getElementById("bookNowBtn");
    if (bookBtn) {
        bookBtn.disabled = selectedSeats.length === 0;
        
        if (selectedSeats.length > 0) {
            bookBtn.innerHTML = `<i class="fas fa-lock"></i> Book Now - ₹${selectedSeats.length * ticketPrice}`;
        } else {
            bookBtn.innerHTML = `<i class="fas fa-lock"></i> Select Seats`;
        }
    }
}

// Enhanced user management functions
function getCurrentUser() {
    return currentUser;
}

function updateUserDetails(name, email, phone) {
    currentUser.name = name || currentUser.name;
    currentUser.email = email || currentUser.email;
    currentUser.phone = phone || currentUser.phone;
}

// Validation functions
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^\d{10}$/.test(phone);
}

function shakeButton(button) {
    button.classList.add("shake");
    setTimeout(() => {
        button.classList.remove("shake");
    }, 500);
}

// Show user details form with improved validation
function showUserDetailsForm() {
    const userForm = document.createElement('div');
    userForm.id = 'userDetailsModal';
    userForm.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    userForm.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 400px; width: 90%;">
            <h3 style="margin-top: 0; color: #333;">Enter Your Details</h3>
            <form id="userDetailsForm">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #555;">Name:</label>
                    <input type="text" id="userName" value="${currentUser.name}" required 
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #555;">Email:</label>
                    <input type="email" id="userEmail" value="${currentUser.email}" required
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #555;">Phone:</label>
                    <input type="tel" id="userPhone" value="${currentUser.phone}" required
                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="button" onclick="closeUserDetailsForm()" 
                            style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Cancel
                    </button>
                    <button type="submit" id="proceedToPaymentBtn"
                            style="flex: 1; padding: 0.75rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Proceed to Payment
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(userForm);
    
    // Add input focus effects
    const inputFields = userForm.querySelectorAll("input");
    inputFields.forEach((input) => {
        input.addEventListener("focus", function () {
            this.parentElement.classList.add("focused");
        });

        input.addEventListener("blur", function () {
            this.parentElement.classList.remove("focused");
        });
    });
    
    document.getElementById('userDetailsForm').onsubmit = function(e) {
        e.preventDefault();
        
        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const proceedBtn = document.getElementById('proceedToPaymentBtn');
        
        // Reset validation
        document.querySelectorAll(".form-group").forEach((group) => {
            group.classList.remove("error");
        });

        let hasError = false;
        
        if (!name) {
            document.getElementById("userName").parentElement.classList.add("error");
            hasError = true;
        }
        
        if (!email || !isValidEmail(email)) {
            document.getElementById("userEmail").parentElement.classList.add("error");
            hasError = true;
        }
        
        if (!phone || !isValidPhone(phone)) {
            document.getElementById("userPhone").parentElement.classList.add("error");
            hasError = true;
        }

        if (hasError) {
            shakeButton(proceedBtn);
            return;
        }
        
        updateUserDetails(name, email, phone);
        closeUserDetailsForm();
        processBookingWithPayment();
    };
}

function closeUserDetailsForm() {
    const modal = document.getElementById('userDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// Main booking function
async function bookTickets() {
    if (selectedSeats.length === 0) {
        alert("Please select at least one seat");
        return;
    }

    // Show user details form first
    showUserDetailsForm();
}

// Enhanced payment processing
async function processBookingWithPayment() {
    const bookBtn = document.getElementById("bookNowBtn")

   if (!bookBtn) {
        console.error("❌ bookNowBtn not found in DOM");
        alert("Booking button not found. Please refresh the page and try again.");
        return;
    }
    const originalText = bookBtn.innerHTML;
    bookBtn.disabled = true;
    bookBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {        
        const user = getCurrentUser();
       if (!user) {
            alert("Please login to book tickets");
            return;
        }

        console.log("Current User:", user);
        const totalAmount = selectedSeats.length * ticketPrice;

        // Prepare booking data before calling the API
         const dummyUser = {
    id: 101, // or any default static userId you want to use
    name: "Guest User"
};
        const bookingPayload = {
            userId: dummyUser.id,
            showId: selectedShow.showId,
            seats: selectedSeats.map(s => s.seatId),
            totalPrice: totalAmount
        };

        // Step 1: Save booking before payment
         const bookingSaveResponse = await fetch(`${api}/book`, {
         method: "POST",
        headers: {
        "Content-Type": "application/json",
        "user-id": user.id
         },
         body: JSON.stringify(bookingPayload),
         });

        const bookingData = await bookingSaveResponse.json();
        console.log("Booking Save Response:", bookingData);

if (bookingData.status !== "success") {
    throw new Error("Booking save failed: " + bookingData.message);
}

const actualBookingId = bookingData.bookingId;
console.log("Booking saved. ID:", actualBookingId);
        
        // Create Razorpay order via backend
        const orderResponse = await fetch(`${api}/payment/create-order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: currentUser.name,
                email: currentUser.email,
                phone: currentUser.phone,
                movieTitle: selectedMovie.title,
                theaterName: selectedTheater.name,
                showTime: selectedShow.showTime || selectedShow.timing || selectedShow.time,
                seats: selectedSeats.map(s => s.seatNumber).join(', '),
                amount: totalAmount,
                showId: selectedShow.showId,
                seatIds: selectedSeats.map(s => s.seatId)
            }),
        });

        if (!orderResponse.ok) {
            throw new Error('Failed to create payment order');
        }

       const orderData = await orderResponse.json();
        const razorpayOrderId = orderData.id;
      
        const options = {
            key: "rzp_test_1Ly2aFyTN5rllj", // Replace with your actual Razorpay key
            amount: totalAmount * 100, // Razorpay expects amount in paise
            currency: "INR",
            name: "EasyBook Movie Tickets",
            description: `${selectedMovie.title} - ${selectedTheater.name}`,
            image: "url('EasyBook.jpeg')", // Add your logo here
            order_id: razorpayOrderId,
            theme: {
                color: "#667eea",
            },
            prefill: {
                name: user.name,
                email: user.email,
                contact: user.phone,
            },
            notes: {
                movie: selectedMovie.title,
                theater: selectedTheater.name,
                show: selectedShow.showTime || selectedShow.timing || selectedShow.time,
                seats: selectedSeats.map(s => s.seatNumber).join(', ')
            },
            modal: {
                backdropclose: false,
                escape: false,
                ondismiss: function () {
                    bookBtn.innerHTML = originalText;
                    bookBtn.disabled = false;
                },
            },
            handler: function (response) {
               console.log("Razorpay Success Response:", response);
    // Call confirmBookingAfterPayment with Razorpay response + booking ID
    confirmBookingAfterPayment(response, actualBookingId);
            },
        };

        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (err) {
        console.error("Payment error:", err);
        
        // Fallback to demo mode for development
        console.log("Backend not available, showing demo booking");
        showDemoBookingSuccess();
        
    } finally {
        bookBtn.disabled = false;
        bookBtn.innerHTML = originalText;
    }
}

async function updateBookingAfterPayment(bookingId) {
   try {
        const bookingPayload = {
            bookingId: bookingId,
            status: "PAID",
            paymentMethod: "ONLINE"
        };

         console.log("Booking Payload:", bookingPayload);

          const response = await fetch(`${api}/bookings/update-payment`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bookingPayload)
        });

         const result = await response.json();
        console.log("Payment Update Response:", result);

        if (result.status === "success") {
            alert("🎉 Booking Successful!");
        } else {
            alert("❌ Booking update failed. Please try again.");
        }
    } catch (error) {
        console.error("Error updating booking after payment:", error);
    }
}

// Confirm booking after successful payment
async function confirmBookingAfterPayment(razorpayResponse, bookingId) {
    const bookBtn = document.getElementById("bookNowBtn");
    
    try {
        bookBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming booking...';

         const bookingData = {
            bookingId: bookingId,
            paymentId: razorpayResponse.razorpay_payment_id,
            paymentStatus: "PAID",
            paymentDate: new Date().toISOString()
        };

        console.log("Booking Payload:", bookingData);
        if (!bookingData) {
    console.error("bookingData is null! Cannot confirm booking.");
    return;
}
        
        // Prepare confirmation request as expected by backend
        const confirmationRequest = await fetch(`${api}/bookings/update-payment`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(bookingData),
        });

        console.log('Confirming booking with:', confirmationRequest);

        const confirmResponse = await fetch(`${api}/confirm-booking`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(bookingData),
        });

        if (!confirmResponse.ok) {
            const errorData = await confirmResponse.json();
            throw new Error(errorData.message || 'Failed to confirm booking');
        }

        const result = await confirmResponse.json();
        console.log("✅ Payment Update Response:", result);
        
        if (result.status === 'success') {
            bookBtn.innerHTML = '<i class="fas fa-check"></i> Booking Confirmed!';
            bookBtn.style.background = "linear-gradient(to right, #10b981, #059669)";
            
            showSuccessMessage({
                bookingId: result.bookingId,
                paymentId: razorpayResponse.razorpay_payment_id,
                orderId: razorpayResponse.razorpay_order_id,
                amount: result.total,
                seatsBooked: result.seats,
                status: "success"
            });
            
            // Show success notification
            showNotification('🎉 Booking confirmed successfully!', 'success');
            
        } else {
            throw new Error(result.message || 'Booking confirmation failed');
        }
        
    } catch (error) {
        console.error('Error confirming booking:', error);
        
        // Still show success message since payment went through
        showSuccessMessage({
            bookingId: `BK${Date.now()}`,
            paymentId: razorpayResponse.razorpay_payment_id,
            orderId: razorpayResponse.razorpay_order_id,
            amount: selectedSeats.length * ticketPrice,
            status: "payment_success",
            message: "Payment successful. Please contact support for booking confirmation."
        });
    }
}

// Demo booking for development/testing
function showDemoBookingSuccess() {
    const mockBooking = {
        bookingId: `BK${Date.now()}`,
        status: "success",
        message: "Booking confirmed (Demo Mode)",
        amount: selectedSeats.length * ticketPrice,
        paymentId: `pay_demo_${Date.now()}`,
        isDemoMode: true
    };
    
    setTimeout(() => {
        showSuccessMessage(mockBooking);
    }, 1500);
}

// Enhanced success message with payment details (updated for backend response) - NO EMAIL REFERENCES
function showSuccessMessage(booking) {
    document.getElementById('bookingFlow').style.display = 'none';
    
    const successDetails = document.getElementById('successDetails');
    const bookingId = booking.bookingId || `BK${Date.now()}`;
    const paymentId = booking.paymentId || 'N/A';
    const isDemo = booking.isDemoMode || (booking.message && booking.message.includes("Demo Mode"));
    const isPaymentOnly = booking.status === "payment_success";
    
    successDetails.innerHTML = `
        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 1rem;">
            <h4 style="color: #28a745; margin-top: 0;">
                ${isPaymentOnly ? '💳 Payment Successful!' : '🎉 Booking Confirmed!'}
            </h4>
            <p><strong>Booking ID:</strong> <span style="color: #667eea;">${bookingId}</span></p>
            <p><strong>Payment ID:</strong> <span style="color: #667eea;">${paymentId}</span></p>
            ${booking.orderId ? `<p><strong>Order ID:</strong> <span style="color: #667eea;">${booking.orderId}</span></p>` : ''}
        </div>
        
        <div style="background: #fff; border: 1px solid #dee2e6; padding: 1.5rem; border-radius: 10px;">
            <h5 style="margin-top: 0; color: #333;">Booking Details</h5>
            <p><strong>Movie:</strong> ${selectedMovie.title}</p>
            <p><strong>Theater:</strong> ${selectedTheater.name}</p>
            <p><strong>City:</strong> ${selectedCity}</p>
            <p><strong>Show Time:</strong> ${selectedShow.showTime || selectedShow.timing || selectedShow.time}</p>
            <p><strong>Seats:</strong> ${booking.seatsBooked || selectedSeats.map(s => s.seatNumber).join(', ')}</p>
            <p><strong>Total Amount:</strong> <span style="color: #28a745; font-weight: bold;">₹${booking.amount || selectedSeats.length * ticketPrice}</span></p>
            <p><strong>Booking Date:</strong> ${new Date().toLocaleString()}</p>
            
            ${isDemo ? `
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 1rem; margin-top: 1rem;">
                    <p style="margin: 0; color: #1976d2; font-style: italic;">
                        <strong>Note:</strong> This is a demo booking. No actual payment was processed.
                    </p>
                </div>
            ` : isPaymentOnly ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; margin-top: 1rem;">
                    <p style="margin: 0; color: #856404;">
                        <strong>⚠️ Note:</strong> ${booking.message || 'Please contact support for booking confirmation.'}
                    </p>
                </div>
            ` : `
                <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 1rem; margin-top: 1rem;">
                    <p style="margin: 0; color: #155724;">
                        <strong>✅ Booking confirmed successfully!</strong> Your tickets are ready.
                    </p>
                </div>
            `}
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
            <p style="margin: 0; color: #856404;">
                <strong>📍 Important:</strong> Please arrive at the theater 15 minutes before show time. 
                Carry a valid photo ID for verification.
            </p>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
            <button onclick="printBookingDetails()" 
                    style="flex: 1; padding: 0.75rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 120px;">
                <i class="fas fa-print"></i> Print Ticket
            </button>
            <button onclick="shareBookingDetails()" 
                    style="flex: 1; padding: 0.75rem; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 120px;">
                <i class="fas fa-share"></i> Share
            </button>
            <button onclick="resetBooking()" 
                    style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; min-width: 120px;">
                <i class="fas fa-home"></i> Book Again
            </button>
        </div>
    `;
    
    document.getElementById('successMessage').style.display = 'block';
    document.getElementById('successMessage').scrollIntoView({ behavior: 'smooth' });
    
    // Mark selected seats as booked in the UI only if booking was fully confirmed
    if (!isPaymentOnly && !isDemo) {
        selectedSeats.forEach(seat => {
            const seatElement = document.querySelector(`[data-seat-id="${seat.seatId}"]`);
            if (seatElement) {
                seatElement.classList.remove('selected', 'available');
                seatElement.classList.add('occupied');
                seatElement.onclick = null;
                seatElement.title = 'Already booked';
            }
        });
    }
    
    // Clear booking progress from localStorage
    clearBookingProgress();
    
    // Add confetti effect for successful booking
    if (!isPaymentOnly) {
        createConfetti();
    }
}

// Reset booking flow
function resetBookingFlow() {
    document.getElementById("cityStep").classList.add('hidden');
    document.getElementById("theaterStep").classList.add('hidden');
    document.getElementById("showStep").classList.add('hidden');
    document.getElementById("seatStep").classList.add('hidden');
    document.getElementById("bookingSummary").classList.add('hidden');
    selectedSeats = [];
    selectedCity = null;
    selectedTheater = null;
    selectedShow = null;
    updateBookingButton();
}

// Reset entire booking process
function resetBooking() {
    // Reset all selections
    selectedMovie = null;
    selectedCity = null;
    selectedTheater = null;
    selectedShow = null;
    selectedSeats = [];
    
    // Reset UI
    document.querySelectorAll('.movie-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.getElementById('bookingFlow').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
    
    // Close any open modals
    closeUserDetailsForm();
    closeErrorModal();
    
    // Clear booking progress
    clearBookingProgress();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.getElementById('home-section').style.display = 'none';
    document.getElementById('about-section').style.display = 'none';
    document.getElementById('contact-section').style.display = 'none';
    
    // Show selected section
    if (sectionName === 'home') {
        document.getElementById('home-section').style.display = 'block';
    } else {
        document.getElementById(sectionName + '-section').style.display = 'block';
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Confetti effect for successful bookings
function createConfetti() {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const confettiContainer = document.createElement('div');
    confettiContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
    `;
    document.body.appendChild(confettiContainer);
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: absolute;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}%;
            animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
            transform: rotate(${Math.random() * 360}deg);
        `;
        confettiContainer.appendChild(confetti);
    }
    
    // Add CSS animation for confetti
    if (!document.getElementById('confetti-styles')) {
        const style = document.createElement('style');
        style.id = 'confetti-styles';
        style.textContent = `
            @keyframes confetti-fall {
                to {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
        confettiContainer.remove();
    }, 5000);
}

// Enhanced error handling
function showErrorMessage(title, message, retryCallback = null) {
    const errorModal = document.createElement('div');
    errorModal.id = 'errorModal';
    errorModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    errorModal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 400px; width: 90%; text-align: center;">
            <div style="color: #dc3545; font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
            <h3 style="margin: 0 0 1rem 0; color: #dc3545;">${title}</h3>
            <p style="color: #666; margin-bottom: 2rem;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="closeErrorModal()" 
                        style="padding: 0.75rem 1.5rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Close
                </button>
                ${retryCallback ? `
                    <button onclick="closeErrorModal(); ${retryCallback}()" 
                            style="padding: 0.75rem 1.5rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Retry
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(errorModal);
}

function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) {
        modal.remove();
    }
}

// Local storage helpers for better user experience
function saveBookingProgress() {
    try {
        const progress = {
            selectedMovie,
            selectedCity,
            selectedTheater,
            selectedShow,
            selectedSeats,
            timestamp: Date.now()
        };
        localStorage.setItem('easybook_progress', JSON.stringify(progress));
    } catch (error) {
        console.error('Error saving booking progress:', error);
    }
}

function loadBookingProgress() {
    try {
        const progress = localStorage.getItem('easybook_progress');
        if (progress) {
            const data = JSON.parse(progress);
            // Only restore if less than 30 minutes old
            if (Date.now() - data.timestamp < 30 * 60 * 1000) {
                return data;
            }
        }
    } catch (error) {
        console.error('Error loading booking progress:', error);
    }
    return null;
}

function clearBookingProgress() {
    try {
        localStorage.removeItem('easybook_progress');
    } catch (error) {
        console.error('Error clearing booking progress:', error);
    }
}

// Restore previous booking progress
async function restoreBookingProgress(progress) {
    try {
        if (progress.selectedMovie) {
            selectedMovie = progress.selectedMovie;
            // Find and select the movie card
            const movieCards = document.querySelectorAll('.movie-card');
            movieCards.forEach(card => {
                if (card.textContent.includes(progress.selectedMovie.title)) {
                    card.classList.add('selected');
                }
            });
            
            document.getElementById('bookingFlow').style.display = 'block';
            await loadCitiesForMovie(progress.selectedMovie.movieId);
            
            if (progress.selectedCity) {
                selectedCity = progress.selectedCity;
                // Continue restoration process...
                // This can be enhanced based on your needs
            }
        }
    } catch (error) {
        console.error('Error restoring progress:', error);
        clearBookingProgress();
    }
}

// Auto-save progress during booking
function autoSaveProgress() {
    if (selectedMovie) {
        saveBookingProgress();
    }
}

// Print booking details function
function printBookingDetails() {
    const printWindow = window.open('', '_blank');
    const bookingDetails = document.getElementById('successDetails').innerHTML;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>EasyBook - Movie Ticket</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 2rem; 
                        background: #f8f9fa;
                    }
                    .ticket-container {
                        background: white;
                        border: 2px dashed #667eea;
                        border-radius: 10px;
                        padding: 2rem;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    h1 { 
                        color: #667eea; 
                        text-align: center;
                        margin-bottom: 2rem;
                    }
                    .booking-details { 
                        background: #f8f9fa; 
                        padding: 1rem; 
                        border-radius: 5px; 
                        margin-bottom: 1rem;
                    }
                    .qr-placeholder {
                        width: 100px;
                        height: 100px;
                        background: #e9ecef;
                        border: 2px solid #dee2e6;
                        margin: 1rem auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        color: #6c757d;
                    }
                    @media print {
                        body { margin: 0; }
                    }
                    .footer {
                        text-align: center;
                        margin-top: 2rem;
                        font-size: 12px;
                        color: #6c757d;
                    }
                </style>
            </head>
            <body>
                <div class="ticket-container">
                    <h1>🎬 EasyBook - Movie Ticket</h1>
                    <div class="booking-details">
                        ${bookingDetails}
                    </div>
                    <div class="qr-placeholder">
                        QR Code
                    </div>
                    <div class="footer">
                        <p>Thank you for choosing EasyBook!</p>
                        <p>Visit us at www.easybook.com</p>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    };
                </script>
            </body>
        </html>
    `);
    
    printWindow.document.close();
}

// Share booking details (Web Share API)
async function shareBookingDetails() {
    const shareText = `🎬 Movie Booked on EasyBook!
    
Movie: ${selectedMovie.title}
Theater: ${selectedTheater.name}
City: ${selectedCity}
Show Time: ${selectedShow.showTime || selectedShow.timing || selectedShow.time}
Seats: ${selectedSeats.map(s => s.seatNumber).join(', ')}
Total: ₹${selectedSeats.length * ticketPrice}

Book your tickets at EasyBook!`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'EasyBook - Movie Booking Confirmed',
                text: shareText,
                url: window.location.href
            });
        } catch (error) {
            console.error('Error sharing:', error);
            fallbackShare(shareText);
        }
    } else {
        fallbackShare(shareText);
    }
}

function fallbackShare(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Booking details copied to clipboard! 📋');
        }).catch(() => {
            showShareModal(text);
        });
    } else {
        showShareModal(text);
    }
}

function showShareModal(text) {
    const shareModal = document.createElement('div');
    shareModal.id = 'shareModal';
    shareModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    shareModal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 10px; max-width: 500px; width: 90%;">
            <h3 style="margin-top: 0; color: #333;">Share Booking Details</h3>
            <textarea readonly style="width: 100%; height: 200px; padding: 1rem; border: 1px solid #ddd; border-radius: 5px; font-family: monospace; font-size: 12px; resize: none; box-sizing: border-box;">${text}</textarea>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button onclick="closeShareModal()" 
                        style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Close
                </button>
                <button onclick="copyShareText('${text.replace(/'/g, "\\'")}'); closeShareModal();" 
                        style="flex: 1; padding: 0.75rem; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Copy Text
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(shareModal);
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.remove();
    }
}

function copyShareText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Booking details copied to clipboard! 📋');
        });
    }
}

// Initialize UI enhancements
function initializeUIEnhancements() {
    // Add CSS for validation, animations, and better UX
    const style = document.createElement("style");
    style.textContent = `
        .form-group.error input {
            border-color: #ef4444 !important;
            background-color: #fef2f2 !important;
        }
        
        .form-group.focused input {
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }
        
        .shake {
            animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        
        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .seat {
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .seat:hover {
            transform: scale(1.1);
        }
        
        .seat.selected {
            background-color: #667eea !important;
            color: white !important;
        }
        
        .seat.occupied {
            background-color: #dc3545 !important;
            color: white !important;
            cursor: not-allowed !important;
        }
        
        .seat.available {
            background-color: #28a745 !important;
            color: white !important;
        }
        
        .movie-card:hover, .selection-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .movie-card.selected, .selection-item.selected {
            border: 2px solid #667eea !important;
            background-color: #f8f9ff !important;
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem;
            border-radius: 5px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
        
        .progress-bar {
            width: 100%;
            height: 6px;
            background-color: #e9ecef;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 1rem;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(to right, #667eea, #764ba2);
            transition: width 0.3s ease;
        }
    `;
    document.head.appendChild(style);
    
    // Add progress bar to booking flow
    addProgressBar();
    
    // Add hover effects
    document.addEventListener('mouseover', function(e) {
        if (e.target.matches('.movie-card, .selection-item, .seat.available')) {
            e.target.style.transform = 'scale(1.05)';
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        if (e.target.matches('.movie-card, .selection-item, .seat.available')) {
            e.target.style.transform = 'scale(1)';
        }
    });
}

// Add progress bar to show booking progress
function addProgressBar() {
    const bookingFlow = document.getElementById('bookingFlow');
    if (bookingFlow) {
        const progressBar = document.createElement('div');
        progressBar.id = 'bookingProgressBar';
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = '<div class="progress-fill" id="progressFill" style="width: 0%;"></div>';
        
        bookingFlow.insertBefore(progressBar, bookingFlow.firstChild);
        updateProgressBar();
    }
}

function updateProgressBar() {
    const progressFill = document.getElementById('progressFill');
    if (!progressFill) return;
    
    let progress = 0;
    
    if (selectedMovie) progress += 20;
    if (selectedCity) progress += 20;
    if (selectedTheater) progress += 20;
    if (selectedShow) progress += 20;
    if (selectedSeats.length > 0) progress += 20;
    
    progressFill.style.width = progress + '%';
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Enhanced selection functions with progress updates
const originalSelectCity = selectCity;
const originalSelectTheater = selectTheater;
const originalSelectShow = selectShow;
const originalToggleSeat = toggleSeat;

selectCity = function(city) {
    originalSelectCity.call(this, city);
    updateProgressBar();
    saveBookingProgress();
};

selectTheater = function(theater) {
    originalSelectTheater.call(this, theater);
    updateProgressBar();
    saveBookingProgress();
};

selectShow = function(show) {
    originalSelectShow.call(this, show);
    updateProgressBar();
    saveBookingProgress();
};

toggleSeat = function(seatElement, seatId, seatNumber) {
    originalToggleSeat.call(this, seatElement, seatId, seatNumber);
    updateProgressBar();
    saveBookingProgress();
};

// Keyboard navigation support
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Close modals on Escape key
        closeUserDetailsForm();
        closeErrorModal();
        closeShareModal();
    }
});

// Auto-save progress every 30 seconds
setInterval(autoSaveProgress, 30000);

// Performance monitoring
const performanceMonitor = {
    startTime: Date.now(),
    
    logTiming: function(action) {
        const currentTime = Date.now();
        console.log(`⏱️ ${action}: ${currentTime - this.startTime}ms`);
        this.startTime = currentTime;
    }
};