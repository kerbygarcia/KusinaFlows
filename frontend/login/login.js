const form = document.getElementById('form')
const username_input = document.getElementById('username-input') 
const password_input = document.getElementById('password-input')
const error_message = document.getElementById('error-message')

form.addEventListener('submit', async (e) => {
   e.preventDefault();

   let errors = getLoginFormErrors(username_input.value, password_input.value);
   if(errors.length > 0){
      error_message.innerText = errors.join(". ");
      return; 
   } 

   error_message.innerText = "Checking credentials...";

   try {
      const response = await fetch('http://localhost:5244/api/auth/login', { 
         method: 'POST',
         headers: {
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({
            username: username_input.value,
            password: password_input.value
         })
      });

      // --- FIX: CHECK STATUS CODE BEFORE PARSING AS JSON ---
      if (response.ok) {
         const data = await response.json();
         error_message.innerText = "";
         
         localStorage.setItem("isLoggedIn", "true");
         localStorage.setItem("currentUser", data.username);
         localStorage.setItem("userRole", data.role); 

         window.location.replace("../dashboard/dashboard.html"); 
      } else {
         // If we get here, the server explicitly rejected the login (like a 401)
         let serverError = "";
         
         try {
            // Try reading as text first to handle empty or plain text bodies safely
            const responseText = await response.text();
            if (responseText) {
               const parsedData = JSON.parse(responseText);
               serverError = parsedData.message || parsedData.error || responseText;
            }
         } catch (parseError) {
            // If it's not JSON, leave it as a plain string string fallback
            serverError = "";
         }

         // If the body was completely empty, fallback based on status code
         if (!serverError && response.status === 401) {
            // If your C# endpoint returned empty Unauthorized(), we use the password fallback
            serverError = "Wrong Password"; 
         }

         const lowerMessage = serverError.toLowerCase();

         // --- EVALUATE ERROR STATES ---
         if (lowerMessage.includes("username") || lowerMessage.includes("exist") || lowerMessage.includes("found")) {
            error_message.innerText = "Unknown Username";
            username_input.parentElement.classList.add('incorrect');
         } else if (lowerMessage.includes("password") || lowerMessage.includes("incorrect") || lowerMessage.includes("wrong") || response.status === 401) {
            // If the server returns a 401, the username exists but the password failed
            error_message.innerText = "Wrong Password";
            password_input.parentElement.classList.add('incorrect');
         } else {
            error_message.innerText = serverError || "Invalid Credentials";
         }
      }

   } catch (error) {
      console.error("Backend Error:", error);
      error_message.innerText = "Can't connect to server. Build backend application.";
   }
});

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