import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bhumitra_national_secret_key_2026_sih';
const VALID_ROLES = ['landowner', 'requiring_body', 'lao_district', 'state_official', 'central_ministry', 'dolr_admin'];

export const register = async (req, res) => {
  try {
    const { name, email, password, role, state_code, district_code } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: true,
        message: 'Name, email, password, and role are required fields.',
        code: 'MISSING_FIELDS'
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: true,
        message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`,
        code: 'INVALID_ROLE'
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: 'A user with this email address already exists.',
        code: 'EMAIL_EXISTS'
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role,
        state_code: state_code || null,
        district_code: district_code || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        state_code: true,
        district_code: true,
        created_at: true
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, state_code: user.state_code, district_code: user.district_code },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      error: false,
      message: 'User registered successfully.',
      data: {
        user,
        token
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({
      error: true,
      message: 'Internal server error during user registration.',
      code: 'SERVER_ERROR'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, state_code: user.state_code, district_code: user.district_code },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      error: false,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          state_code: user.state_code,
          district_code: user.district_code,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      error: true,
      message: 'Internal server error during user login.',
      code: 'SERVER_ERROR'
    });
  }
};
