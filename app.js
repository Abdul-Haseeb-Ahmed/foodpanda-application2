import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  remove,
  update
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUrKAT4ZTTAQjgVLuf83oGe2hI5LfGhPk",
  authDomain: "food-panda-application-2a839.firebaseapp.com",
  databaseURL: "https://food-panda-application-2a839-default-rtdb.firebaseio.com",
  projectId: "food-panda-application-2a839",
  storageBucket: "food-panda-application-2a839.appspot.com",
  messagingSenderId: "354197474968",
  appId: "1:354197474968:web:e1051ccd600a6c3fc78aed",
  measurementId: "G-PZKVKPFKN5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Make functions accessible globally if needed
window.addDish = addDish;
window.saveDishChanges = saveDishChanges;

// Global variables
let currentUser = null;
let cart = {};

// Sign Up
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("s-name").value;
    const email = document.getElementById("s-email").value;
    const password = document.getElementById("s-pass").value;
    const confirmPassword = document.getElementById("s-cpass").value;

    if (password !== confirmPassword) {
      document.getElementById("error-message").textContent = "Passwords do not match.";
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await set(ref(database, `users/${userCredential.user.uid}`), {
        name,
        email,
        role: 'admin'
      });
      Swal.fire("Account Created", "Your admin account has been created.", "success")
        .then(() => window.location.href = "admin login.html");
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  });
}

// Login
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("l-email").value;
    const password = document.getElementById("l-pass").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      Swal.fire("Login Successful", "Redirecting to dashboard...", "success")
        .then(() => window.location.href = "dashboard.html");
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  });
}

// Logout
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      Swal.fire("Logged Out", "Redirecting to login...", "success")
        .then(() => window.location.href = "admin login.html");
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  });
}

// Dashboard Auth Check
let authUnsubscribe = null;
let dashboardInitialized = false;

document.addEventListener("DOMContentLoaded", () => {
  authUnsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) {
      if (window.location.pathname.includes("dashboard")) {
        window.location.href = "admin login.html";
      }
    } else {
      currentUser = user;
      initializeDashboard(user);
    }
  });
});

window.addEventListener("beforeunload", () => {
  if (authUnsubscribe) authUnsubscribe();
});

function initializeDashboard(user) {
  if (dashboardInitialized) return;
  dashboardInitialized = true;

  const userRef = ref(database, `users/${user.uid}`);
  onValue(userRef, (snapshot) => {
    const userData = snapshot.val();
    console.log("User data:", userData);
    if (userData) {
      const nameElem = document.getElementById("admin-name");
      const emailElem = document.getElementById("admin-email");

      if (nameElem && emailElem) {
        nameElem.textContent = userData.name;
        emailElem.textContent = userData.email;
      } else {
        console.warn("admin-name or admin-email elements not found.");
      }
    }
  });

  initializeCharts();
  loadMenuItems();
  setupEventListeners();
  loadUserCart();
}

function setupEventListeners() {
  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');

      const target = this.getAttribute('href');
      document.getElementById("dashboard-section").style.display = target === '#dashboard' ? 'block' : 'none';
      document.getElementById("restaurants-section").style.display = target === '#restaurants' ? 'block' : 'none';
      document.getElementById("cart-section").style.display = target === '#cart' ? 'block' : 'none';
      
      if (target === '#cart') {
        loadCartUI();
      }
    });
  });

  document.getElementById("addDishForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    addDish();
  });

  document.getElementById("editDishForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveDishChanges();
  });

  document.getElementById("checkout-btn")?.addEventListener("click", () => {
    checkoutCart();
  });
}

function loadMenuItems() {
  const menuItemsRef = ref(database, 'menuItems');
  onValue(menuItemsRef, (snapshot) => {
    const items = snapshot.val();
    const container = document.getElementById("menu-items-container");
    container.innerHTML = '';

    if (items) {
      Object.entries(items).forEach(([id, item]) => {
        container.appendChild(createMenuItemCard(id, item));
      });
    } else {
      container.innerHTML = '<div class="col-12 text-center py-5">No menu items found.</div>';
    }
  });
}

function createMenuItemCard(id, item) {
  const col = document.createElement("div");
  col.className = "col-md-6 col-lg-4 col-xl-3 mb-4";

  let imageSrc = item.imageUrl || '';
  
  if (!imageSrc.startsWith('http') && !imageSrc.startsWith('data:image')) {
    console.warn(`Invalid image URL for item ${id}: ${imageSrc}`);
    imageSrc = 'https://via.placeholder.com/300x180?text=No+Image';
  }

  // Check if item is in cart
  const isInCart = cart[id] ? true : false;

  col.innerHTML = `
    <div class="card h-100 menu-item-card">
      <img src="${imageSrc}" 
           class="card-img-top menu-item-img" 
           alt="${item.name || 'Menu item'}"
           onerror="this.onerror=null;this.src='https://via.placeholder.com/300x180?text=Image+Error'">
      <div class="card-body menu-item-body">
        <h5 class="menu-item-title">${item.name || 'Unnamed Item'}</h5>
        <p class="menu-item-desc">${item.description || ''}</p>
        <p class="menu-item-price">$${(item.price || 0).toFixed(2)}</p>
        <div class="menu-item-actions">
          <div class="input-group" style="width: 120px;">
            <button class="btn btn-outline-secondary minus-btn" type="button">-</button>
            <input type="number" class="form-control text-center quantity-input" value="1" min="1">
            <button class="btn btn-outline-secondary plus-btn" type="button">+</button>
          </div>
          <button class="btn btn-sm btn-success add-to-cart-btn" data-id="${id}" ${isInCart ? 'disabled' : ''}>
            <i class="fas fa-cart-plus"></i> ${isInCart ? 'In Cart' : 'Add'}
          </button>
        </div>
        <div class="mt-2">
          <button class="btn btn-sm btn-primary btn-edit" data-id="${id}">Edit</button>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${id}">Delete</button>
        </div>
      </div>
    </div>
  `;

  col.querySelector('.btn-edit').addEventListener("click", () => openEditModal(id, item));
  col.querySelector('.btn-delete').addEventListener("click", () => deleteMenuItem(id));
  
  // Only add event listeners if not in cart
  if (!isInCart) {
    const addToCartBtn = col.querySelector('.add-to-cart-btn');
    const quantityInput = col.querySelector('.quantity-input');
    const plusBtn = col.querySelector('.plus-btn');
    const minusBtn = col.querySelector('.minus-btn');
    
    plusBtn.addEventListener('click', () => {
      quantityInput.value = parseInt(quantityInput.value) + 1;
    });
    
    minusBtn.addEventListener('click', () => {
      if (parseInt(quantityInput.value) > 1) {
        quantityInput.value = parseInt(quantityInput.value) - 1;
      }
    });
    
    addToCartBtn.addEventListener('click', () => {
      const quantity = parseInt(quantityInput.value) || 1;
      addToCart(id, item, quantity);
    });
  }

  return col;
}
function loadUserCart() {
  if (!currentUser) return;

  const cartRef = ref(database, `userCarts/${currentUser.uid}`);
  onValue(cartRef, (snapshot) => {
    const cartData = snapshot.val();
    cart = cartData || {};
    
    // Reload menu items to update their cart status
    loadMenuItems();
    
    // Update cart UI if cart section is visible
    if (document.getElementById("cart-section").style.display === 'block') {
      loadCartUI();
    }
  });
}

function addToCart(itemId, item, quantity = 1) {
  if (!currentUser) return;

  const cartItem = {
    ...item,
    quantity: cart[itemId] ? cart[itemId].quantity + quantity : quantity
  };

  update(ref(database, `userCarts/${currentUser.uid}/${itemId}`), cartItem)
    .then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Added to cart',
        text: `${quantity} ${item.name} added to cart`,
        timer: 1000,
        showConfirmButton: false
      });
      // Reload menu items after adding to cart
      loadMenuItems();
    })
    .catch(error => {
      Swal.fire('Error', 'Failed to add item to cart: ' + error.message, 'error');
    });
}

function loadCartUI() {
  const cartItemsContainer = document.getElementById("cart-items");
  
  if (!cartItemsContainer) return;
  
  cartItemsContainer.innerHTML = '';
  
  if (!cart || Object.keys(cart).length === 0) {
cartItemsContainer.innerHTML = `
  <tr class="empty-row">
    <td colspan="5">
      <i class="fas fa-shopping-cart"></i><br>
      Your cart is empty
    </td>
  </tr>
`;
    document.getElementById("cart-total").textContent = '$0.00';
    return;
  }
  
  let total = 0;
  
  Object.entries(cart).forEach(([id, item]) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>
        <div class="input-group" style="width: 120px;">
          <button class="btn btn-outline-secondary cart-minus-btn" type="button" data-id="${id}">-</button>
          <input type="number" class="form-control text-center cart-quantity-input" value="${item.quantity}" min="1" data-id="${id}">
          <button class="btn btn-outline-secondary cart-plus-btn" type="button" data-id="${id}">+</button>
        </div>
      </td>
      <td>$${itemTotal.toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-danger remove-item-btn" data-id="${id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    
    cartItemsContainer.appendChild(row);
  });
  
  document.getElementById("cart-total").textContent = `$${total.toFixed(2)}`;
  
  // Add event listeners for cart controls
  document.querySelectorAll('.cart-plus-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      updateCartItem(id, cart[id].quantity + 1);
    });
  });
  
  document.querySelectorAll('.cart-minus-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      if (cart[id].quantity > 1) {
        updateCartItem(id, cart[id].quantity - 1);
      }
    });
  });
  
  document.querySelectorAll('.cart-quantity-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const newQuantity = parseInt(e.target.value) || 1;
      updateCartItem(id, newQuantity);
    });
  });
  
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('button').getAttribute('data-id');
      removeFromCart(id);
    });
  });
}

function updateCartItem(itemId, newQuantity) {
  if (!currentUser || !cart[itemId]) return;

  update(ref(database, `userCarts/${currentUser.uid}/${itemId}`), {
    quantity: newQuantity
  }).catch(error => {
    Swal.fire('Error', 'Failed to update item quantity: ' + error.message, 'error');
  });
}

function removeFromCart(itemId) {
  if (!currentUser || !cart[itemId]) return;

  remove(ref(database, `userCarts/${currentUser.uid}/${itemId}`))
    .then(() => {
      // Reload menu items to re-enable the add button
      loadMenuItems();
    })
    .catch(error => {
      Swal.fire('Error', 'Failed to remove item from cart: ' + error.message, 'error');
    });
}

function checkoutCart() {
  if (!currentUser || Object.keys(cart).length === 0) {
    Swal.fire('Error', 'Your cart is empty', 'error');
    return;
  }
  
  Swal.fire({
    title: 'Confirm Checkout',
    text: `Total: $${calculateCartTotal().toFixed(2)}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Place Order',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      const orderData = {
        userId: currentUser.uid,
        items: cart,
        total: calculateCartTotal(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // Save order to Firebase
      const newOrderRef = push(ref(database, 'orders'));
      set(newOrderRef, orderData)
        .then(() => {
          // Clear the cart after successful order
          remove(ref(database, `userCarts/${currentUser.uid}`))
            .then(() => {
              Swal.fire('Success', 'Order placed successfully!', 'success');
            })
            .catch(error => {
              Swal.fire('Error', 'Failed to clear cart: ' + error.message, 'error');
            });
        })
        .catch(error => {
          Swal.fire('Error', 'Failed to place order: ' + error.message, 'error');
        });
    }
  });
}

function calculateCartTotal() {
  return Object.values(cart).reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
}

// ... rest of your existing functions (addDish, saveDishChanges, deleteMenuItem, initializeCharts, etc.) ...
function addDish() {
  const name = document.getElementById("dishName").value.trim();
  const price = parseFloat(document.getElementById("dishPrice").value);
  const description = document.getElementById("dishDescription").value.trim();
  let imageUrl = document.getElementById("dishImage").value.trim();

  if (!name || isNaN(price)) {
    return Swal.fire("Error", "Please enter a valid name and price", "error");
  }

  // Validate image URL
  if (imageUrl && !imageUrl.match(/^(http|https|data:image)/)) {
    return Swal.fire("Error", "Please enter a valid image URL starting with http://, https://, or data:image", "error");
  }

  // Set default image if none provided
  if (!imageUrl) {
    imageUrl = "https://via.placeholder.com/300x180?text=No+Image";
  }

  const newDish = {
    name,
    price,
    description,
    imageUrl,
    createdAt: new Date().toISOString()
  };

  const newDishRef = push(ref(database, 'menuItems'));
  set(newDishRef, newDish).then(() => {
    Swal.fire("Success", "Dish added", "success");
    const form = document.getElementById("addDishForm");
    if (form && typeof form.reset === 'function') {
      form.reset();
    }
    const modal = bootstrap.Modal.getInstance(document.getElementById("addDishModal"));
    if (modal) modal.hide();
  });
}

function openEditModal(id, item) {
  document.getElementById("editDishId").value = id;
  document.getElementById("editDishName").value = item.name;
  document.getElementById("editDishPrice").value = item.price;
  document.getElementById("editDishDescription").value = item.description;
  document.getElementById("editDishImage").value = item.imageUrl;

  const editModal = new bootstrap.Modal(document.getElementById('editDishModal'));
  editModal.show();
}

function saveDishChanges() {
  const id = document.getElementById("editDishId").value;
  const name = document.getElementById("editDishName").value.trim();
  const price = parseFloat(document.getElementById("editDishPrice").value);
  const description = document.getElementById("editDishDescription").value.trim();
  const imageUrl = document.getElementById("editDishImage").value.trim();

  if (!name || isNaN(price)) {
    return Swal.fire("Error", "Please enter valid name and price", "error");
  }

  update(ref(database, `menuItems/${id}`), {
    name,
    price,
    description,
    imageUrl,
    updatedAt: new Date().toISOString()
  }).then(() => {
    Swal.fire("Success", "Dish updated", "success");
    bootstrap.Modal.getInstance(document.getElementById("editDishModal")).hide();
  });
}

function deleteMenuItem(id) {
  Swal.fire({
    title: "Are you sure?",
    text: "This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!"
  }).then((result) => {
    if (result.isConfirmed) {
      remove(ref(database, `menuItems/${id}`)).then(() => {
        Swal.fire("Deleted!", "Your dish has been removed.", "success");
      });
    }
  });
}

function initializeCharts() {
  const ordersChart = document.getElementById("ordersChart");
  if (ordersChart) {
    new Chart(ordersChart.getContext("2d"), {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          label: "Orders",
          data: [12, 19, 15, 20, 25, 30, 27],
          borderColor: "#d70f64",
          backgroundColor: "rgba(215, 15, 100, 0.1)",
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  const statusChart = document.getElementById("statusChart");
  if (statusChart) {
    new Chart(statusChart.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Delivered", "Pending", "Cancelled"],
        datasets: [{
          data: [60, 30, 10],
          backgroundColor: ["#4caf50", "#ffc107", "#f44336"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        cutout: "70%"
      }
    });
  }
}