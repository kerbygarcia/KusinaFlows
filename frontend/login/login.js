const form = document.getElementById('form')
const username_input = document.getElementById('username-input') // Remember to make this match Step 1!
const password_input = document.getElementById('password-input')
const error_message = document.getElementById('error-message')

form.addEventListener('submit', async (e) => {
   // Prevent the form from refreshing the page automatically
   e.preventDefault()

   // 1. Perform basic local blank checks first
   let errors = getLoginFormErrors(username_input.value, password_input.value)

   if(errors.length > 0){
      error_message.innerText = errors.join(". ")
      return; // Stop here if fields are empty
   } 

   // 2. Clear previous errors and show a loading state
   error_message.innerText = "Checking credentials..."

   try {
      // 3. Send credentials to your C# Backend API
      const response = await fetch('http://localhost:5244/api/auth/login', { // Adjust port if yours is different
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            username: username_input.value,
            password: password_input.value
         })
      });

      const data = await response.json();
    if (response.ok) {
         error_message.innerText = "";
         
         // Save the validation keys and role sent back from your C# API response
         localStorage.setItem("isLoggedIn", "true");
         localStorage.setItem("currentUser", data.username);
         localStorage.setItem("userRole", data.role); // e.g. "manager" or "employee"

         // Switch screens securely using .replace
         window.location.replace("../dashboard/dashboard.html"); 
    }

   } catch (error) {
      // API Server is offline or blocked
      console.error("Backend Error:", error);
      error_message.innerText = "Can't connect to server. Build backend application.";
   }
})

// Strict check function: Only ensures fields are filled out locally
function getLoginFormErrors(username, password){
    let errors = []

    if(username === '' || username == null){
        errors.push('Username is required')
        username_input.parentElement.classList.add('incorrect')
    }

    if(password === '' || password == null){
        errors.push('Password is required')
        password_input.parentElement.classList.add('incorrect')
    }

    return errors;
}

// Track input changes to clear the red error styling on the fly
const allInputs = [username_input, password_input]

allInputs.forEach(input =>{
    input.addEventListener('input', () => {
        if(input.parentElement.classList.contains('incorrect')){
            input.parentElement.classList.remove('incorrect')
            error_message.innerText = ''
        }
    })
})