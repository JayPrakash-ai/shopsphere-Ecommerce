require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Backend health check
app.get("/", (req, res) => {
  res.json({
    message: "E-Commerce Marketplace Backend is running!",
  });
});

// Get all products from PostgreSQL
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products ORDER BY id DESC"
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Fetch products error:", error.message);
    res.status(500).json({ error: "Unable to fetch products" });
  }
});

// Add a new product to PostgreSQL
app.post("/api/products", async (req, res) => {
  try {
    const { name, category, price, description, image_url, stock } = req.body;

    if (!name || !category || price === undefined || Number(price) <= 0) {
      return res.status(400).json({
        error: "Valid name, category and price are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (name, category, price, description, image_url, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        category,
        price,
        description || null,
        image_url || null,
        stock ?? 0,
      ]
    );

    res.status(201).json({
      message: "Product added successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Add product error:", error.message);
    res.status(500).json({ error: "Unable to add product" });
  }
});

// Place a new order
app.post("/api/orders", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      customer_name,
      email,
      phone,
      address,
      items,
    } = req.body;

    // Validate customer details
    if (
      !customer_name ||
      !email ||
      !phone ||
      !address ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Please provide valid customer details and cart items",
      });
    }

    await client.query("BEGIN");

    let totalAmount = 0;
    const orderItems = [];

    // Verify products and calculate total using database prices
    for (const item of items) {
      const productId = item.id ?? item.product_id;
      const quantity = Number(item.quantity);

      if (
        !Number.isInteger(Number(productId)) ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        throw new Error("Invalid product ID or quantity");
      }

      const productResult = await client.query(
        `SELECT id, name, price, stock
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error("Product not found");
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const price = Number(product.price);

      totalAmount += price * quantity;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        price,
      });
    }

    // Save customer order
    const orderResult = await client.query(
      `INSERT INTO orders
       (customer_name, email, phone, address, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        customer_name,
        email,
        phone,
        address,
        totalAmount,
        "pending",
      ]
    );

    const order = orderResult.rows[0];

    // Save individual order items and update stock
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, product_name, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.price,
        ]
      );

      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Place order error:", error.message);

    res.status(500).json({
      error: error.message || "Unable to place order",
    });

  } finally {
    client.release();
  }
});

// Delete a product from PostgreSQL
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({
        error: "Invalid product ID",
      });
    }

    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING *",
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    res.status(200).json({
      message: "Product deleted successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Delete product error:", error.message);
    res.status(500).json({
      error: "Unable to delete product",
    });
  }
});

// Update an existing product in PostgreSQL
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description, image_url, stock } = req.body;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    if (!name || !category || price === undefined || Number(price) <= 0) {
      return res.status(400).json({
        error: "Valid name, category and price are required",
      });
    }

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           category = $2,
           price = $3,
           description = $4,
           image_url = $5,
           stock = $6
       WHERE id = $7
       RETURNING *`,
      [
        name,
        category,
        Number(price),
        description || null,
        image_url || null,
        Number(stock ?? 0),
        Number(id),
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    res.status(500).json({ error: "Unable to update product" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { customer_name, email, phone, address, items, total_amount } = req.body;

  if (
    !customer_name ||
    !email ||
    !phone ||
    !address ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      error: "All customer details and cart items are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders
       (customer_name, email, phone, address, total_amount)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [customer_name, email, phone, address, total_amount]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, product_name, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.id, item.name, item.quantity, item.price]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Place order error:", error.message);
    res.status(500).json({ error: "Unable to place order" });
  } finally {
    client.release();
  }
});

// Get customer order history
app.get("/api/orders", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: "Customer email is required",
      });
    }

    const result = await pool.query(
      `SELECT
         o.id,
         o.customer_name,
         o.email,
         o.phone,
         o.address,
         o.total_amount,
         o.status,
         o.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'quantity', oi.quantity,
               'price', oi.price
             )
           ) FILTER (WHERE oi.id IS NOT NULL),
           '[]'
         ) AS items
       FROM orders o
       LEFT JOIN order_items oi
         ON o.id = oi.order_id
       WHERE LOWER(o.email) = LOWER($1)
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [email]
    );

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: result.rows,
    });

  } catch (error) {
    console.error("Fetch orders error:", error.message);

    res.status(500).json({
      error: "Unable to fetch orders",
    });
  }
});

// Admin Login API
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    const result = await pool.query(
      "SELECT * FROM admins WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const admin = result.rows[0];

    const isPasswordValid = await require("bcryptjs").compare(
      password,
      admin.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const token = require("jsonwebtoken").sign(
      {
        id: admin.id,
        email: admin.email,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Admin login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });

  } catch (error) {
    console.error("Admin login error:", error.message);

    res.status(500).json({
      error: "Unable to login admin"
    });
  }
});

// Admin Authentication Middleware
const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Access denied. Admin token required."
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = require("jsonwebtoken").verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded.role !== "admin") {
      return res.status(403).json({
        error: "Admin access only"
      });
    }

    req.admin = decoded;
    next();

  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired admin token"
    });
  }
};

// Admin: Get all customer orders
app.get("/api/admin/orders", verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        o.id,
        o.customer_name,
        o.email,
        o.phone,
        o.address,
        o.total_amount,
        o.status,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'price', oi.price
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC`
    );

    res.status(200).json({
      message: "All orders fetched successfully",
      orders: result.rows
    });

  } catch (error) {
    console.error("Admin fetch orders error:", error.message);
    res.status(500).json({
      error: "Unable to fetch all orders"
    });
  }
});

// Admin: Update order status
app.put("/api/admin/orders/:id/status", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid order status"
      });
    }

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: result.rows[0]
    });

  } catch (error) {
    console.error("Update order status error:", error.message);

    res.status(500).json({
      error: "Unable to update order status"
    });
  }
});


app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});