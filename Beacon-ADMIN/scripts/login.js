// ==========================
// LOGIN PAGE SCRIPT - Connect na lang sa DB
// ==========================

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const errorMessageDiv = document.getElementById('errorMessage');

    if (!window.supabase) {
      console.error("Supabase client not initialized. Make sure supabase.js is loaded.");
      errorMessageDiv.textContent = "A configuration error occurred.";
      return;
    }

    console.log("Login script initialized (Supabase Mode).");

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Stop default form submission

        // Clear previous errors and disable button
        errorMessageDiv.textContent = '';
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email || !password) {
            errorMessageDiv.textContent = 'Please enter both email and password.';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                console.error("Login error:", error.message);
                errorMessageDiv.textContent = error.message;
            } else if (data.session) {
                console.log("Login successful!");
                window.location.href = 'index.html';
            } else {
                errorMessageDiv.textContent = 'Login failed. Please try again.';
            }

        } catch (err) {
            console.error("Unexpected login error:", err);
            errorMessageDiv.textContent = 'An unexpected error occurred. Please try again.';
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

});