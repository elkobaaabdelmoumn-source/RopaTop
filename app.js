// =========================
// FIREBASE
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgKIPEz5F6sY1dMeOZ9Rbt_QUlR8CaLYo",
  authDomain: "ropatop-6f837.firebaseapp.com",
  projectId: "ropatop-6f837",
  storageBucket: "ropatop-6f837.firebasestorage.app",
  messagingSenderId: "893050753580",
  appId: "1:893050753580:web:9827c5610137214812f789"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================
// DATOS BASE / LOCALSTORAGE
// =========================
let users = JSON.parse(localStorage.getItem("users")) || [{ email: "admin@admin.com", code: "1234", active: true, super: true }];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let settings = JSON.parse(localStorage.getItem("settings")) || { title: "Tienda Profesional de Zapatos", mainColor: "#333", bgColor: "#f4f4f4" };
let whatsappNumber = localStorage.getItem("whatsappNumber") || "34662218632";
let orders = JSON.parse(localStorage.getItem("orders")) || [];
let currentUser = null;
let products = [];

// =========================
// FUNCIONES DE UTILIDAD
// =========================
function saveAll() {
  localStorage.setItem("users", JSON.stringify(users));
  localStorage.setItem("cart", JSON.stringify(cart));
  localStorage.setItem("settings", JSON.stringify(settings));
  localStorage.setItem("orders", JSON.stringify(orders));
  localStorage.setItem("whatsappNumber", whatsappNumber);
}

function finalPrice(p) {
  return p.price - (p.price * p.offer) / 100;
}

function updateCount() {
  document.getElementById("count").textContent = cart.reduce((a, b) => a + b.qty, 0);
}

function show(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  if (pageId === "shop") renderShop();
  if (pageId === "cart") renderCart();
  if (pageId === "admin") renderAdminLogin();
}

// =========================
// CARGAR PRODUCTOS DESDE FIREBASE
// =========================
async function loadProducts() {
  const querySnapshot = await getDocs(collection(db, "products"));
  products = [];
  querySnapshot.forEach((docSnap) => {
    products.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderShop();
}
loadProducts();

// =========================
// RENDER TIENDA
// =========================
function renderShop() {
  const shop = document.getElementById("shop");
  document.getElementById("title").textContent = settings.title;
  document.documentElement.style.setProperty("--main", settings.mainColor);
  document.documentElement.style.setProperty("--bg", settings.bgColor);
  shop.innerHTML = "";

  if (products.length === 0) {
    shop.innerHTML = "<p style='text-align:center;'>No hay productos disponibles.</p>";
    return;
  }

  products.forEach(p => {
    const sizeOptions = Object.entries(p.stock || {})
      .map(([size, qty]) => qty > 0 ? `<option value='${size}'>${size} (${qty})</option>` : `<option value='${size}' disabled>${size} (agotado)</option>`)
      .join('');

    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image">
        ${p.offer ? `<div class="label-offer">-${p.offer}%</div>` : ''}
        <img class="main-img" src="${p.images[0]}" alt="${p.name}">
        ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((img,idx)=>`<img src="${img}" onclick="this.closest('.product-card').querySelector('.main-img').src='${img}'">`).join('')}</div>` : ''}
      </div>
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>$${finalPrice(p).toFixed(2)}</p>
        ${sizeOptions ? `<select id="size-${p.id}">${sizeOptions}</select>` : '<p>No hay stock</p>'}
        <input type="number" min="1" value="1" id="qty-${p.id}">
        <button onclick="addToCartWithSize('${p.id}')">🛒 Añadir</button>
      </div>
    `;
    shop.appendChild(card);
  });

  updateCount();
}

// =========================
// CARRITO
// =========================
async function addToCartWithSize(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const sizeSelect = document.getElementById(`size-${id}`);
  const size = sizeSelect ? sizeSelect.value : null;
  if (!size) return alert("Selecciona una talla con stock");

  const qty = Math.max(1, parseInt(document.getElementById(`qty-${id}`).value) || 1);
  if (product.stock[size] < qty) return alert(`Solo hay ${product.stock[size]} unidades disponibles de la talla ${size}`);
  product.stock[size] -= qty;

  // Actualizar stock en Firebase
  const productRef = doc(db, "products", id);
  await updateDoc(productRef, { [`stock.${size}`]: product.stock[size] });

  const existing = cart.find(item => item.id === id && item.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id: product.id, name: product.name, price: product.price, offer: product.offer, size, qty });

  saveAll();
  updateCount();
  renderShop();
}

function renderCart() {
  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = "<h2>Carrito</h2>";
  let total = 0;
  if(cart.length === 0){ cartDiv.innerHTML += "<p>El carrito está vacío</p>"; return; }
  cart.forEach(item => {
    const price = finalPrice(item) * item.qty;
    total += price;
    const pEl = document.createElement("p");
    pEl.innerHTML = `${item.name} - Talla ${item.size} x${item.qty} - $${price.toFixed(2)} <button onclick='removeFromCart("${item.id}", "${item.size}")'>❌</button>`;
    cartDiv.appendChild(pEl);
  });
  cartDiv.innerHTML += `<h3>Total: $${total.toFixed(2)}</h3>
    <hr>
    <h3>Finalizar compra</h3>
    <input id='c_name' placeholder='Nombre completo'><br>
    <input id='c_phone' placeholder='Teléfono móvil'><br>
    <input id='c_address' placeholder='Dirección completa'><br>
    <input id='c_street' placeholder='Calle'><br>
    <input id='c_floor' placeholder='Piso'><br><br>
    <button onclick='sendOrder()'>📲 Enviar por WhatsApp</button>`;
}

function removeFromCart(id,size){
  const index = cart.findIndex(p=>p.id===id && p.size===size);
  if(index===-1)return;
  const product = products.find(p=>p.id===id);
  if(product && product.stock[size]!==undefined) product.stock[size]+=cart[index].qty;
  cart.splice(index,1);
  saveAll();
  renderCart();
  renderShop();
}

// =========================
// ORDEN POR WHATSAPP
// =========================
function sendOrder() {
  const name = document.getElementById('c_name').value;
  const phone = document.getElementById('c_phone').value;
  const address = `${document.getElementById('c_address').value}, ${document.getElementById('c_street').value}, Piso ${document.getElementById('c_floor').value}`;
  if(!name||!phone||!address)return alert("Completa todos los campos");

  let msg=`🛒 *Nuevo pedido*\n\n👤 ${name}\n📞 ${phone}\n🏠 ${address}\n\n`;
  let total=0;
  cart.forEach(item=>{ msg+=`• ${item.name} - Talla ${item.size} x${item.qty}\n`; total+=finalPrice(item)*item.qty; });
  msg+=`\n💰 Total: $${total.toFixed(2)}`;

  orders.push({date:new Date().toLocaleString(), customer:{name,phone,address}, items:cart, total});
  cart=[];
  saveAll();
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`);
  renderCart();
  renderShop();
}

// =========================
// INICIALIZACIÓN
// =========================
show('shop');
