import { useState, useEffect } from "react";
import "./App.css";

const categories = ["All", "Electronics", "Fashion", "Accessories"];

const productDesigns = {
  "Wireless Headphones": { emoji: "🎧", color: "#e8eaff" },
  "Classic Sneakers": { emoji: "👟", color: "#fff0e5" },
  "Smart Watch": { emoji: "⌚", color: "#e5f5ed" },
  "Everyday Backpack": { emoji: "🎒", color: "#f8e8ee" },
  "Digital Camera": { emoji: "📷", color: "#e9f2fa" },
  "Sunglasses": { emoji: "🕶️", color: "#f7f0df" },
};

function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);

  const [showCheckout, setShowCheckout] = useState(false);
  const [customer, setCustomer] = useState({ 
    customer_name: "", 
    email: "", 
    phone: "", 
    address: "",
  });
  const [orderMessage, setOrderMessage] = useState("");

  const [editingProduct, setEditingProduct] = useState(null);
  const [editMessage, setEditMessage] = useState("");

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "Electronics",
    price: "",
    description: "",
    stock: "",
  });

  const [adminMessage, setAdminMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [myOrders, setMyOrders] = useState([]);

  const [adminToken, setAdminToken] = useState(localStorage.getItem("adminToken") || "" );
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginMessage, setAdminLoginMessage] = useState("");

  const adminLogout = () => {
    setAdminToken("");
    localStorage.removeItem("adminToken");
    setAdminLoginMessage("Admin logged out successfully!");
    setAdminOrders([]);
  };

  const [adminOrders, setAdminOrders] = useState([]);
  const [adminOrdersMessage, setAdminOrdersMessage] = useState("");

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [ordersMessage, setOrdersMessage] = useState("");

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch("http://localhost:5000/api/products");

        if (!response.ok) {
          throw new Error("Unable to fetch products");
        }

        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError("Products load nahi ho paaye. Backend server check karo.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || product.category === category;
    return matchesSearch && matchesCategory;
  });

  async function handleAddProduct(event) {
  event.preventDefault();
  setAdminMessage("");

  try {
    const response = await fetch("http://localhost:5000/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...newProduct,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Product could not be added");
    }

    setProducts((previousProducts) => [
      data.product,
      ...previousProducts,
    ]);

    setNewProduct({
      name: "",
      category: "Electronics",
      price: "",
      description: "",
      stock: "",
    });

    setAdminMessage("Product added successfully!");
  } catch (error) {
    setAdminMessage(error.message);
    console.error("Add product error:", error);
  }
}

async function deleteProduct(productId) {
  const confirmDelete = window.confirm(
    "Are you sure you want to delete this product?"
  );

  if (!confirmDelete) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:5000/api/products/${productId}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to delete product");
    }

    setProducts((previousProducts) =>
      previousProducts.filter((product) => product.id !== productId)
    );

    setAdminMessage("Product deleted successfully!");
  } catch (error) {
    console.error("Delete product error:", error);
    setAdminMessage(error.message);
  }
}

async function fetchMyOrders(email) {
  try {
    setOrdersMessage("");

    const response = await fetch(
      `http://localhost:5000/api/orders?email=${encodeURIComponent(email)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to fetch orders");
    }

    setMyOrders(data.orders);
    console.log("My Orders Data:", data.orders);
    setShowMyOrders(true);

    if (data.orders.length === 0) {
      setOrdersMessage("No orders found.");
    }
  } catch (error) {
    console.error("Fetch orders error:", error);
    setOrdersMessage(error.message);
  }
}

async function updateProduct(event) {
  event.preventDefault();
  setEditMessage("");

  try {
    const response = await fetch(
      `http://localhost:5000/api/products/${editingProduct.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editingProduct,
          price: Number(editingProduct.price),
          stock: Number(editingProduct.stock),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update product");
    }

    setProducts((previousProducts) =>
      previousProducts.map((product) =>
        product.id === data.product.id ? data.product : product
      )
    );

    setEditMessage("Product updated successfully!");
    setEditingProduct(null);
  } catch (error) {
    console.error("Update product error:", error);
    setEditMessage(error.message);
  }
}

  function addToCart(product) {
  setCart((previousCart) => {
    const existingProduct = previousCart.find(
      (item) => item.id === product.id
    );

    if (existingProduct) {
      return previousCart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    }

    return [...previousCart, { ...product, quantity: 1 }];
  });
}

function updateCartQuantity(productId, change) {
  setCart((previousCart) =>
    previousCart
      .map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + change }
          : item
      )
      .filter((item) => item.quantity > 0)
  );
}

function removeFromCart(productId) {
  setCart((previousCart) =>
    previousCart.filter((item) => item.id !== productId)
  );
}

async function placeOrder(event) {
  event.preventDefault();
  console.log("PLACE ORDER FUNCTION CALLED");
  setOrderMessage("");

  try {
    const response = await fetch("http://localhost:5000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...customer,
        items: cart,
        total_amount: cartTotal,
      }),
    });

    const data = await response.json();

    console.log("ORDER API RESPONSE:", data);

    if (!response.ok) {
      throw new Error(data.error || "Unable to place order");
    }

    setOrderMessage(`Order placed successfully! Order ID: ${data.order.id}`);
    setCart([]);
    setCustomer({
      customer_name: "",
      email: "",
      phone: "",
      address: "",
    });
    setShowCheckout(false);
  } catch (error) {
    console.error("Place order error:", error);
    setOrderMessage(error.message);
  }
}



const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);

const adminLogin = async (event) => {
  event.preventDefault();

  try {
    const response = await fetch(
      "http://localhost:5000/api/admin/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword
        })
      }
    );

    const data = await response.json();

    if (response.ok) {
      setAdminToken(data.token);
      localStorage.setItem("adminToken", data.token);
      setAdminLoginMessage("Admin login successful!");
      setAdminPassword("");
    } else {
      setAdminLoginMessage(data.error || "Login failed");
    }
  } catch (error) {
    console.error("Admin login error:", error);
    setAdminLoginMessage("Something went wrong");
  }
};

const fetchAdminOrders = async () => {
  try {
    const response = await fetch(
      "http://localhost:5000/api/admin/orders",
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (response.ok) {
      setAdminOrders(data.orders);
      setAdminOrdersMessage("");
    } else {
      setAdminOrdersMessage(data.error || "Unable to fetch orders");
    }
  } catch (error) {
    console.error("Fetch admin orders error:", error);
    setAdminOrdersMessage("Something went wrong while fetching orders");
  }
};

const updateOrderStatus = async (orderId, newStatus) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/admin/orders/${orderId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: newStatus
        })
      }
    );

    const data = await response.json();

    if (response.ok) {
      setAdminOrders((previousOrders) =>
        previousOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus }
            : order
        )
      );

      setAdminOrdersMessage("Order status updated successfully!");
    } else {
      setAdminOrdersMessage(data.error || "Unable to update status");
    }
  } catch (error) {
    console.error("Update status error:", error);
    setAdminOrdersMessage("Something went wrong");
  }
};

  return (
    <div className="app">
      <header className="navbar">
        <a className="logo" href="#">ShopSphere<span>.</span></a>

        <div className="search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button className="cart-button" onClick={() => alert(`Items in cart: ${cart.length}`)}>
          🛒 Cart ({cart.length})
        </button>

        <button className="cart-button" onClick={() => {
            const email = window.prompt("Enter your order email address:");

            if (email && email.trim()) {
              fetchMyOrders(email.trim());
            }
          }}
        >
          📦 My Orders
        </button>

        <button className="cart-button" onClick={() => setShowAdmin(!showAdmin)}>
          ⚙️ Admin
        </button>

      </header>

      {showMyOrders && (
       <section className="orders-section">

        {!adminToken ? (
        <form onSubmit={adminLogin}>
        <h2>Admin Login</h2>

          <input
            type="email"
            placeholder="Admin Email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Admin Password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            required
          />

          <button type="submit">Admin Login</button>

          {adminLoginMessage && <p>{adminLoginMessage}</p>}
        </form>
      ) : (
        <>
          <h2>Welcome Admin</h2>
          <button onClick={adminLogout}>Admin Logout</button>
          {adminLoginMessage && <p>{adminLoginMessage}</p>}

        </>
      )}

      <h2>📦 My Orders</h2>

      <button
        className="cart-button"
        onClick={() => setShowMyOrders(false)}
      >
        Close Orders
      </button>

      {ordersMessage && <p>{ordersMessage}</p>}

      {myOrders.map((order) => (
        <div className="order-card" key={order.id}>
          <h3>Order #{order.id}</h3>

          <p><strong>Name:</strong> {order.customer_name}</p>
          <p><strong>Email:</strong> {order.email}</p>
          <p><strong>Total:</strong> ₹{order.total_amount}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p>
            <strong>Date:</strong>{" "}
            {new Date(order.created_at).toLocaleString()}
          </p>

          <h4>Products:</h4>

          {order.items.map((item, index) => (
            <p key={index}>
              {item.product_name} — Quantity: {item.quantity} — ₹{item.price}
            </p>
          ))}
        </div>
      ))}
    </section>
  )}

  <main>

    <section className="admin-section">
        

      <h2>Customer Orders</h2>

      <button
        className="add-button"
        onClick={fetchAdminOrders}
      >
        View All Orders
      </button>

      {adminOrdersMessage && (
        <p>{adminOrdersMessage}</p>
      )}

      {adminOrders.map((order) => (
        <div className="product-card" key={order.id}>
          <h3>Order ID: {order.id}</h3>

          <p>Customer: {order.customer_name}</p>
          <p>Email: {order.email}</p>
          <p>Phone: {order.phone}</p>
          <p>Address: {order.address}</p>

          <div className="order-items">
            <h4>Ordered Products:</h4>

            {order.items && order.items.length > 0 ? 
            (
              order.items.map((item, index) => (
                <div key={index}>
                  <p>Product: {item.product_name}</p>
                  <p>Quantity: {item.quantity}</p>
                  <p>Price: ₹{item.price}</p>
                </div>  
              ))
            ) : (
             <p>No products found.</p>
          )}
          </div>
          <p>Total: ₹{order.total_amount}</p>
          <p>Status: {order.status}</p>

          <select
            value={order.status || "Pending"}
            onChange={(event) =>
              updateOrderStatus(order.id, event.target.value)
            }
           >

            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      ))}
    </section>

    {showAdmin && (
      <section className="admin-section">
        <h2>Admin – Add New Product</h2>

        <form onSubmit={handleAddProduct} className="admin-form">
          <input
            type="text"
            placeholder="Product name"
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
            required
          />

          <select
            value={newProduct.category}
            onChange={(e) =>
              setNewProduct({ ...newProduct, category: e.target.value })
            }
          >
            <option value="Electronics">Electronics</option>
            <option value="Fashion">Fashion</option>
            <option value="Accessories">Accessories</option>
          </select>

          <input
            type="number"
            placeholder="Price"
            min="1"
            value={newProduct.price}
            onChange={(e) =>
              setNewProduct({ ...newProduct, price: e.target.value })
            }
            required
          />

          <textarea
            placeholder="Product description"
            value={newProduct.description}
            onChange={(e) =>
              setNewProduct({ ...newProduct, description: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Stock quantity"
            min="0"
            value={newProduct.stock}
            onChange={(e) =>
              setNewProduct({ ...newProduct, stock: e.target.value })
            }
            required
          />

          <button type="submit" className="add-button">
            Add Product
          </button>

          {adminMessage && <p>{adminMessage}</p>}
          </form>
          </section>
          )}

          {editingProduct && (
            <section className="admin-section">
              <h2>Edit Product</h2>

              <form onSubmit={updateProduct} className="admin-form">
              <input
                type="text"
                placeholder="Product name"
                value={editingProduct.name}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    name: e.target.value,
                  })
                }
                required
              />

              <select
                value={editingProduct.category}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    category: e.target.value,
                  })
                }
              >

                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Accessories">Accessories</option>
                </select>

                <input
                  type="number"
                  placeholder="Price"
                  min="1"
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      price: e.target.value,
                    })
                  }
                  required
                />

                <textarea
                  placeholder="Product description"
                  value={editingProduct.description || ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Stock quantity"
                  min="0"
                  value={editingProduct.stock}
                  onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    stock: e.target.value,
                  })
                }
                required
              />

              <button type="submit" className="add-button">
                Update Product
              </button>

              <button
                type="button"
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </button>

              {editMessage && <p>{editMessage}</p>}
            </form>
          </section>
        )}
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR EVERYDAY MARKETPLACE</p>
            <h1>Find your next<br />favorite thing.</h1>
            <p className="hero-text">Discover great products for your everyday life.</p>
            <a href="#products" className="shop-button">Explore products →</a>
          </div>
          <div className="hero-art" aria-label="Shopping bags" role="img">🛍️</div>
        </section>

        <section className="cart-section">
          <h2>Shopping Cart</h2>

          {cart.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
           <>
             {cart.map((item) => (
               <div className="cart-item" key={item.id}>
                 <h3>{item.name}</h3>
                 <p>Price: ₹{item.price}</p>
                 
                 <div className="cart-quantity">
                  <button onClick={() => updateCartQuantity(item.id, -1)}>
                    -
                  </button>

                  <span>{item.quantity}</span>

                  <button onClick={() => updateCartQuantity(item.id, 1)}>
                    +
                  </button>
                 </div>

                 <p>Subtotal: ₹{Number(item.price) * item.quantity}</p>

                 <button className="delete-button" onClick={() => removeFromCart(item.id)}>
                   Remove
                 </button>
               </div>
             ))}

             <h3>Cart Total: ₹{cartTotal.toFixed(2)}</h3>
             <button className="add-button" disabled={cart.length === 0} onClick={() => { setShowCheckout(true); setOrderMessage("");}}>
               Proceed to Checkout
             </button>
           </>
          )}
        </section>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HANDPICKED FOR YOU</p>
              <h2>Explore products</h2>
            </div>
            <span className="product-count">{filteredProducts.length} products</span>
          </div>

          <div className="categories">
            {categories.map((item) => (
              <button
                key={item}
                className={`category-button ${category === item ? "active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {loading && <p>Loading products...</p>}
          {error && <p>{error}</p>}

          {!loading && !error && (
            <div className="product-grid">
              {filteredProducts.map((product) => {
                const design = productDesigns[product.name] || {
                  emoji: "🛍️",
                  color: "#f2f2f2",
                };

                return (
                  <article className="product-card" key={product.id}>
                    <div className="product-image" style={{ backgroundColor: design.color }}>
                      <span>{design.emoji}</span>
                      <span className="product-tag">{product.category}</span>
                    </div>

                    <div className="product-info">
                      <p className="product-category">{product.category}</p>
                      <h3>{product.name}</h3>
                      <div className="product-bottom">
                        <strong>₹{Number(product.price).toLocaleString("en-IN")}</strong>

                        
                        <button className="add-button" onClick={() => addToCart(product)}>
                          + Add
                        </button>

                        <button className="edit-button" onClick={() => { setEditingProduct({ ...product }); setEditingMessage("");}}>
                          Edit
                        </button>

                        <button className="delete-button" onClick={() => deleteProduct(product.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {filteredProducts.length === 0 && (
                <p>No products found. Try another search.</p>
              )}
            </div>
          )}
        </section>
        {showCheckout && (
          <section className="admin-section">
            <h2>Checkout</h2>

            <form onSubmit={placeOrder} className="admin-form">
              <input
                type="text"
                placeholder="Full Name"
                value={customer.customer_name}
                onChange={(e) =>
                  setCustomer({ ...customer, customer_name: e.target.value })
                }
                required
              />

             <input
               type="email"
               placeholder="Email Address"
               value={customer.email}
               onChange={(e) =>
                 setCustomer({ ...customer, email: e.target.value })
               }
               required
             />

             <input
               type="tel"
               placeholder="Phone Number"
               value={customer.phone}
               onChange={(e) =>
                 setCustomer({ ...customer, phone: e.target.value })
               }
               required
             />

             <textarea
               placeholder="Delivery Address"
               value={customer.address}
               onChange={(e) =>
                 setCustomer({ ...customer, address: e.target.value })
               }
               required
             />

             <h3>Order Total: ₹{cartTotal.toFixed(2)}</h3>

             <button type="submit" className="add-button">
               Place Order
             </button>

             <button type="button" onClick={() => setShowCheckout(false)}>
               Cancel
             </button>
           </form>
         </section>
       )}
       {orderMessage && (<p className="order-message">{orderMessage}</p>)}
      </main>

      <footer>© 2026 ShopSphere. Built for everyday discoveries.</footer>
    </div>
  );
}

export default App;