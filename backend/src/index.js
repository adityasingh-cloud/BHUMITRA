import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';

import authRoutes from './modules/auth/auth.routes.js';
import parcelRoutes from './modules/parcels/parcels.routes.js';
import compensationRoutes from './modules/compensation/compensation.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import grievanceRoutes from './modules/grievances/grievances.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import adapterAdminRoutes from './modules/adapters_admin/adapters_admin.routes.js';

import { initRabbitMQ } from './services/rabbitmq.service.js';
import { initCronScheduler } from './services/scheduler.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger OpenAPI 3.0 Documentation Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bhumitra National Land Acquisition API',
      version: '1.0.0',
      description: 'API Documentation for DoLR Ministry of Rural Development Land Acquisition System (RFCTLARR Act 2013)',
      contact: {
        name: 'Bhumitra Engineering Team',
        email: 'support@bhumitra.gov.in'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local Development Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/modules/**/*.routes.js']
};

const swaggerSpecs = swaggerJsDoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', auditRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adapterAdminRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    error: false,
    status: 'ONLINE',
    system: 'Bhumitra DoLR Backend microservices core API gateway',
    timestamp: new Date().toISOString(),
    swagger_docs: `http://localhost:${PORT}/api/docs`
  });
});

// Standard 404 Route Handler
app.use((req, res) => {
  return res.status(404).json({
    error: true,
    message: `Endpoint '${req.originalUrl}' not found. Check /api/docs for API endpoints.`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Server Error:', err);
  return res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR'
  });
});

// Start Server & Background Services
app.listen(PORT, async () => {
  console.log(`🚀 Bhumitra API Gateway running on port ${PORT}`);
  console.log(`📚 OpenAPI / Swagger UI live at http://localhost:${PORT}/api/docs`);

  // Initialize RabbitMQ Broker & Background Cron Scheduler
  await initRabbitMQ();
  initCronScheduler();
});

export default app;
