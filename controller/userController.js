const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv').config();
const User = require("../model/userModel");
const randomstring=require('randomstring')
const Product = require("../model/productModel");
const Address = require('../model/addressModel');
const Category = require('../model/categoryModel');
const Brand = require('../model/brandModel');
const Cart=require('../model/cartModel')
const Order = require('../model/orderModel');
const { authenticate } = require('passport');


const loadHome = async (req, res) => {
  try {
    const user = req.session.user || req.user;
    const id = req.query.id;

    let userData = null;
    if (id) {
      userData = await User.findById(id);
    }

    const searchQuery = req.query.q || '';
    let products;

    if (searchQuery.trim()) {
      const regex = new RegExp(searchQuery, 'i');
      products = await Product.find({
        is_deleted: false,
        productName: regex
      }).populate('brand').populate('category');
    } else {
      products = await Product.find({ is_deleted: false })
        .populate('brand')
        .populate('category')
        .limit(10);
    }

    res.render('home', { user, userData, products, searchQuery });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send(error.message);
  }
};







const loadLogin = (req, res) => {
    try {
        res.render("login");
    } catch (error) {
        res.send(error.message);
    }
};




const loadRegister = (req, res) => {
    try {
        res.render("register");
    } catch (error) {
        res.send(error.message);
    }
};

// const authenticateUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Find the user by email
//     const user = await User.findOne({ email: email });

//     if (!user) {
//       return res.render('login', { message: "Invalid email or password" });
//     }

//     // Check if the account is blocked
//     if (user.is_blocked === 1) {
//       return res.render('login', { message: "Your account has been blocked" });
//     }

//     // Compare the password
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.render('login', { message: "Invalid email or password" });
//     }

//     // Successful authentication, store user ID in session
//     req.session.user_id = user._id;
//     res.redirect(`/home?id=${user._id}`);
    
//   } catch (error) {
//     // Handle any other errors
//     console.error(error);
//     res.status(500).render('login', { message: "An error occurred. Please try again later." });
//   }
// };

// user authenticate

const authenticateUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.render('login', { message: "Invalid email or password" });
    }

    // Check if the account is blocked
    if (user.is_blocked) {
      return res.render('login', { message: "Your account has been blocked" });
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('login', { message: "Invalid email or password" });
    }

    // Successful authentication, store user ID in session
    req.session.user_id = user._id;
    res.redirect(`/home?id=${user._id}`);
    
  } catch (error) {
    // Handle any other errors
    console.error(error);
    res.status(500).render('login', { message: "An error occurred. Please try again later." });
  }
};



// user logout
const logoutUser = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send(err.message);
        }
        res.redirect('/home');
    });
};

// generate OTP
const generateOTP = () => {
    return randomstring.generate({
      length: 6,
      charset: "numeric",
    });
  };
  
  const securePassword = async (password) => {
    try {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      return passwordHash;
    } catch (error) {
      console.log(error);
      throw error;
    }
  };
  
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  
  const sendOTPEmail = (email, otp) => {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "OTP Verification",
  
      text: `Your OTP for verification is: ${otp}`,

    };
  
    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          reject(error);
        } else {
          console.log("Email sent: " + info.response);
          resolve(info.response);
        }
  });
  });
  };



let otpStore = {};

const insertUser = async (req, res) => {
  // console.log("insertUser called for email:", req.body.email);
  try {
    const { name, phone, email, password, confirmPassword } = req.body;

    const user = await User.findOne({ email: email });
    if (user) {
      return res.render("register", { message: "The email is already exists. Please login and continue" });
    } else {
      const spassword = await securePassword(password);

      const otp = generateOTP();
      otpStore[email] = {
        otp,
        userData: { name, phone, email, password: spassword },
      };
      console.log(otp), await sendOTPEmail(email, otp);

      res.redirect(`/verify-otp?email=${email}`);

    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const loadVerifyOtp = async (req, res) => {
  try {
    const { email } = req.query;
    if (!otpStore[email]) {
      res.status(400).send("No OTP found for this email");
      return;
    }

    res.render("otp", {
      email,
      message: "Enter the OTP sent to your email.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

// const verifyOTP = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     if (otpStore[email] && otpStore[email].otp === otp) {
//       const userData = new User({
//         ...otpStore[email].userData,
       
//       });

//       const savedUser = await userData.save();
//       delete otpStore[email];

//       req.session.user = savedUser;
//       res.redirect(`/home?email=${email}`);

//     } else {
//       res.status(400).send("Invalid OTP");
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Internal Server Error");
// }
// };

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (otpStore[email] && otpStore[email].otp === otp) {
      const userData = new User({
        ...otpStore[email].userData,
       
      });

      const savedUser = await userData.save();
      delete otpStore[email];

      req.session.user = savedUser;
      
      // Send a success response with email data
      res.json({ success: true, email: email });
    } else {
      // Send an error response with a message
      res.json({ success: false, message: 'Invalid OTP. Please try again.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};


const resentOTP = async (req, res) => {
    try {
      const { email } = req.query;
      if (!otpStore[email]) {
        res.status(400).send("No OTP found for this email");
        return;
      }
  
      const newOTP = generateOTP();
      otpStore[email].otp = newOTP;
      await sendOTPEmail(email, newOTP);
      console.log(`Resent OTP for ${email}: ${newOTP}`);
  
      res.status(200).send("OTP resent successfully.");
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to resend OTP.");
  }
  };

//   const loadShopPage = async (req, res) => {
//     try {
//         // Fetch user data
//         const userData = req.user || {}; // Adjust according to how you manage user data
//         const user = req.session.user || req.user;
//         // Fetch only listed products
//         const products = await Product.find({ is_deleted: false });

//         // Render the shop view and pass userData and products
//         res.render('shop', {user,userData, products });
//     } catch (error) {
//         console.error('Error loading shop page:', error);
//         res.status(500).send('Internal Server Error');
//     }
// };


const loadShopPage = async (req, res) => {
  try {
   
    const user = req.session.user_id || req.user;
   
    
    const userData= await User.findById(user)
    // Set default filter values
    const defaultFilters = {
      minPrice: 0,
      maxPrice: 100000,
      sort: 'popularity'
    };

    // Merge default filters with query params
    const filters = { ...defaultFilters, ...req.query };

    const filter = { is_deleted: false };
    if (filters.brand) filter.brand = { $in: filters.brand.split(',') };
    if (filters.category) filter.category = { $in: filters.category.split(',') };
    if (filters.shape) filter.shape = { $in: filters.shape.split(',') };

    filter.price = {
      $gte: Number(filters.minPrice),
      $lte: Number(filters.maxPrice)
    };

    let sortOption = {};
    switch (filters.sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'name-asc':
        sortOption = { productName: 1 };
        break;
      case 'name-desc':
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 }; // Default sort by newest
    }

    const products = await Product.find(filter)
      .sort(sortOption)
      .populate('brand')
      .populate('category');

    const brands = await Brand.find();
    const categories = await Category.find();
    const shapes = [...new Set(await Product.distinct('shape'))];

    res.render('shop', {
     
      userData,
      products,
      brands,
      categories,
      shapes,
      currentFilters: filters
    });
  } catch (error) {
    console.error('Error loading shop page:', error);
    res.status(500).send('Internal Server Error');
  }
};


const getFilteredProducts = async (req, res) => {
  try {
    const { brand, category, minPrice, maxPrice, shape, sort } = req.query;

    const filter = { is_deleted: false };

    if (brand) filter.brand = { $in: brand.split(',') };
    if (category) filter.category = { $in: category.split(',') };
    if (shape) filter.shape = { $in: shape.split(',') };
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortOption = {};
    switch (sort) {
      case 'price-asc':
        sortOption = { price: 1 };
        break;
      case 'price-desc':
        sortOption = { price: -1 };
        break;
      case 'name-asc':
        sortOption = { productName: 1 };
        break;
      case 'name-desc':
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 }; // Default sort by newest
    }

    const products = await Product.find(filter)
      .sort(sortOption)
      .populate('brand')
      .populate('category');

    res.json({ products });
  } catch (error) {
    console.error('Error fetching filtered products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



const getProductDetails = async (req, res) => {
  try {
    const user = req.session.user || req.user;
    const id = user ? user._id : null;
    const userData = id ? await User.findById(id) : {};
    
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const relatedProducts = await Product.find({
      _id: { $ne: productId } 
    }).limit(4); 
    const byBrand = await Product.find({
      brand: product.brand, 
      _id: { $ne: productId } 
    }).limit(4);

    res.render('singleProduct', { user, userData, product, relatedProducts, byBrand });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};


// address
// Render address list

const loadAddressPage = async (req, res) => {
  try {
    const userId = req.session.user_id;
   

    if (!userId) {
      return res.redirect('/login');
    }

    const addresses = await Address.find({ user: userId });


    res.render('address', { addresses });
  } catch (error) {
    console.error('Error fetching addresses:', error); // Improved error logging
    res.status(500).send('Server Error');
  }
};



const addAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;  // Retrieve user ID from session
    const newAddress = new Address({ ...req.body, user: userId });  // Create a new Address instance
    await newAddress.save();  // Save address to the database
    res.redirect('/address');  // Redirect to address page
  } catch (error) {
    console.error(error);  // Log error
    res.status(500).send('Server Error');  // Send error response
  }
};


const editAddress = async (req, res) => {
  try {
      const addressId = req.params.id;
      const updatedData = {
          fullName: req.body.fullName,
          addressLine1: req.body.addressLine1,
          addressLine2: req.body.addressLine2,
          city: req.body.city,
          state: req.body.state,
          postalCode: req.body.postalCode,
          country: req.body.country,
          phoneNumber: req.body.phoneNumber
      };

      const updatedAddress = await Address.findByIdAndUpdate(addressId, updatedData, { new: true });

      if (updatedAddress) {
          res.status(200).json({ success: true, address: updatedAddress });
      } else {
          res.status(404).json({ success: false, message: 'Address not found' });
      }
  } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({ success: false, message: 'Error updating address' });
  }
};

// Delete address
const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    await Address.findByIdAndDelete(addressId);
    res.redirect('/address');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

const loadProfile = async (req, res) => {
  try {
      if (!req.session.user_id) {
          return res.redirect('/login'); // Redirect to login if not authenticated
      }
      const user = await User.findById(req.session.user_id);
      if (!user) {
          return res.status(404).send('User not found');
      }
      res.render('profile', { user });
  } catch (error) {
      res.status(500).send(error.message);
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
      const { name, email, phone, currentPassword, newPassword, confirmNewPassword } = req.body;
      const user = await User.findById(req.session.user_id);

      if (!user) {
          return res.status(404).send('User not found');
      }

      // Update user details
      user.name = name;
      user.email = email;
      user.phone = phone;

      if (newPassword) {
          // Check current password and new password match
          const isMatch = await bcrypt.compare(currentPassword, user.password);
          if (!isMatch) {
              return res.status(400).send('Current password is incorrect');
          }
          if (newPassword !== confirmNewPassword) {
              return res.status(400).send('New passwords do not match');
          }
          user.password = await bcrypt.hash(newPassword, 10); // Hash new password before saving
      }

      await user.save();
      res.redirect('/profile');
  } catch (error) {
      res.status(500).send(error.message);
  }
};

// load cart

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.id;

    if (!userId) {
      return res.redirect('/login');
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send('Product not found');
    }

    if (product.stockQuantity <= 0) {
      return res.status(400).send('Product is out of stock');
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      if (existingItem.quantity >= product.stockQuantity) {
        return res.status(400).send('Cannot add more of this item - stock limit reached');
      }
      existingItem.quantity += 1;
    } else {
      cart.items.push({ productId, quantity: 1 });
    }

    await cart.save();
    res.redirect('/cart');
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).send('Error adding to cart');
  }
};

const getCart = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = req.session.user || req.user;
    const id = req.query.id;

    let userData = null;
    if (id) {
      userData = await User.findById(id);
    }
        
        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        res.render('cart', { cart, userData });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).send('Error fetching cart');
    }
};


const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user_id;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    const item = cart.items.find(item => item.productId._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found in cart' });
    }

    const product = item.productId;
    if (quantity > product.stockQuantity) {
      return res.status(400).json({ success: false, error: 'Quantity exceeds available stock' });
    }

    item.quantity = quantity;
    await cart.save();

    const updatedItemTotal = item.quantity * product.price;
    const updatedCartTotal = cart.items.reduce((total, cartItem) => total + cartItem.quantity * cartItem.productId.price, 0);

    res.json({
      success: true,
      updatedItemTotal,
      updatedCartTotal
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, error: 'Error updating cart' });
  }
}

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user_id;

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $pull: { items: { productId } } },
      { new: true } // This option returns the modified document after update
    ).populate('items.productId');

    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    const updatedCartTotal = cart.items.reduce((total, item) => total + item.quantity * item.productId.price, 0);

    res.json({ success: true, updatedCartTotal });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, error: 'Error removing from cart' });
  }
};





// fogot-password

const loadForgotPassword = async (req, res) => {
  res.render('forgot-password');
};

const handleForgotPassword = async (req, res) => {
  try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
          return res.render('forgot-password', { message: "No account with that email address exists." });
      }

      // The random bytes generated are converted into a string of hexadecimal (hex) format

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = resetTokenExpiry;
      await user.save();

      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      });

      const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

      const mailOptions = {
          to: user.email,
          from: process.env.EMAIL_USER,
          subject: 'Password Reset',
          text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                `${resetUrl}\n\n` +
                `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      };

      await transporter.sendMail(mailOptions);
      res.render('forgot-password', { message: `An email has been sent to ${user.email} with further instructions.` });

  } catch (error) {
      console.error(error);
      res.status(500).render('forgot-password', { message: "An error occurred. Please try again later." });
  }
};

const loadResetPassword = async (req, res) => {
  const { token } = req.params;
  const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpiry: { $gt: Date.now() } });

  if (!user) {
      return res.render('forgot-password', { message: "Password reset token is invalid or has expired." });
  }

  res.render('reset-password', { token });
};

const handleResetPassword = async (req, res) => {
  try {
      const { token } = req.params;
      const { password, confirmPassword } = req.body;

      if (password !== confirmPassword) {
          return res.render('reset-password', { token, message: "Passwords do not match." });
      }

      const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpiry: { $gt: Date.now() } });

      if (!user) {
          return res.render('forgot-password', { message: "Password reset token is invalid or has expired." });
      }

      user.password = await bcrypt.hash(password, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();

      res.redirect('/login');
  } catch (error) {
      console.error(error);
      res.status(500).render('reset-password', { token, message: "An error occurred. Please try again later." });
  }
};

// checkout page
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    const addresses = await Address.find({ user: userId });
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    res.render('checkout', { addresses, cart, userData });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
};

const checkoutAddAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.json({ success: false, message: 'User not logged in' });
    }

    const newAddress = new Address({
      user: userId,
      fullName: req.body.fullName,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      postalCode: req.body.postalCode,
      country: req.body.country,
      phoneNumber: req.body.phoneNumber
    });

    await newAddress.save();

    // Fetch all updated addresses after saving the new one
    const addresses = await Address.find({ user: userId });

    res.json({ success: true, addresses });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'An error occurred while adding the address' });
  }
};



const generateOrderId = () => {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: 'Shipping address and payment method are required' });
    }

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (let item of cart.items) {
      const product = item.productId;
      if (!product) {
        return res.status(404).json({ message: `Product not found for item ${item._id}` });
      }

      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for product: ${product.productName}` });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product_id: product._id,
        productName: product.productName,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
        status: 'Pending'
      });

      // Update stock quantity
      product.stockQuantity -= item.quantity;
      await product.save();
    }

    const address = await Address.findById(shippingAddress);

    if (!address) {
      return res.status(404).json({ message: 'Shipping address not found' });
    }

    const newOrder = new Order({
      user_id: user._id,
      order_id: generateOrderId(),
      address_id: address,
      items: orderItems,
      total_amount: totalAmount,
      payment_type: paymentMethod,
      payment_status: 'Pending'
    });

    await newOrder.save();

    // Clear cart
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

    res.json({ success: true, orderId: newOrder._id });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'An error occurred while placing the order. Please try again later.' });
  }
};



const orderSummary = async (req, res) => {
  try {
      const userId = req.session.user_id;
      const orderId = req.params.orderId; // Get orderId from route parameters

      if (!orderId) {
          return res.status(400).render('error', { message: 'Order ID is required' });
      }

      const order = await Order.findById(orderId)
        .populate('user_id')
        .populate({
          path: 'items.product_id',
          select: 'productName imageUrl price' // Populate fields you need
        });

      if (!order) {
          return res.status(404).render('error', { message: 'Order not found' });
      }

      const addresses = await Address.find({ user: userId });

      res.render('orderSummary', { order, addresses });
  } catch (error) {
      console.error(error);
      res.status(500).render('error', { message: 'Error fetching order summary' });
  }
};

// Render the orders page
const renderOrdersPage = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect("/login");
    }
    
    const orders = await Order.find({ user_id: userId });
    res.render('orders', { orders });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error retrieving orders: ' + error.message);
  }
};

// Render the view order page
const renderViewOrder = async (req, res) => {
  try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId).populate('items.product_id');

      if (!order) {
          return res.status(404).render('error', { message: 'Order not found' });
      }

      res.render('viewOrder', { order });
  } catch (error) {
      console.error(error);
      res.status(500).render('error', { message: 'Error retrieving order details' });
  }
};


// Handle cancel order item request
const cancelOrderItem = async (req, res) => {
  try {
      const { itemId, cancellationReason } = req.body;

      const order = await Order.findOne({ "items._id": itemId });

      if (!order) {
          return res.status(404).render('error', { message: 'Order item not found' });
      }

      const item = order.items.id(itemId);
      if (item.status === 'Pending') {
          item.status = 'Cancelled';
          item.cancellation_reason = cancellationReason;
          await order.save();
      }

      res.redirect(`/viewOrder/${order._id}`);
  } catch (error) {
      console.error(error);
      res.status(500).render('error', { message: 'Error cancelling order item' });
  }
};


// Handle return request for order item
const requestReturn = async (req, res) => {
  try {
      const { itemId, returnReason } = req.body;

      const order = await Order.findOne({ "items._id": itemId });

      if (!order) {
          return res.status(404).render('error', { message: 'Order item not found' });
      }

      const item = order.items.id(itemId);
      if (item.status === 'Delivered') {
          item.status = 'Return Requested';
          item.return_reason = returnReason;
          await order.save();
      }

      res.redirect(`/viewOrder/${order._id}`);
  } catch (error) {
      console.error(error);
      res.status(500).render('error', { message: 'Error processing return request' });
  }
};






module.exports = {
    loadHome,
    loadLogin,
    loadRegister,
    verifyOTP,
    loadVerifyOtp,
    insertUser,
    resentOTP,
    authenticateUser,
    logoutUser,
    loadProfile,
    loadShopPage ,
    getFilteredProducts,
     getProductDetails,
     loadAddressPage,
    //  loadAddAddressPage,
     addAddress,
    
     deleteAddress,
     editAddress,
     updateProfile,
     addToCart,
     getCart,
     updateCart,
     removeFromCart,
     loadCheckout,
     checkoutAddAddress,
     loadForgotPassword,
     handleForgotPassword,
     loadResetPassword,
     handleResetPassword,
     placeOrder,
     orderSummary,
     renderOrdersPage,
     renderViewOrder,
     renderViewOrder,
     cancelOrderItem,
     requestReturn
  
    
    
};
