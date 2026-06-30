import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoute.js";
import productsRouter from "./routes/productsRouter.js";
import serviceRouter from "./routes/serviceRouter.js";
import settingsRouter from "./routes/settingRouter.js";
import userRouter from "./routes/userRouter.js";
import barberRouter from "./routes/barberRouter.js";
import appointmentRouter from "./routes/appointmentRouter.js";
import blockedDateRouter from "./routes/blockedDateRouter.js";
import subscriptionPlanRouter from "./routes/subscriptionPlanRouter.js";
import subscriptionRouter from "./routes/subscriptionRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import paymentMethodRouter from "./routes/paymentMethodRouter.js";
import galleryRouter from "./routes/galleryRouter.js";
import pagarmeRoutes from "./routes/pagarmeRoutes.js";
import pagarmeSubs from "./routes/pagarmeSubscriptionRouter.js";
import dependentRouter from "./routes/dependentRouter.js";
import savedCardRouter from "./routes/savedCardRouter.js";
import employeeValeRouter from "./routes/employeeValeRouter.js";
import employeePaymentRouter from "./routes/employeePaymentRouter.js";
import superAdminRouter from "./routes/superAdminRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import platformPlanRouter from "./routes/platformPlanRouter.js";
import cashClosingRouter from "./routes/cashClosingRouter.js";
import areschatSetupRouter from "./routes/areschatSetupRouter.js";
import areschatIntegrationRouter from "./modules/integrations/areschat/http/routes/areschatIntegrationRouter.js";

const app = express();
const corsOptions: cors.CorsOptions = { origin: true };

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.send({ ok: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "html");
app.engine("html", hbs.__express);
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("./static"));
app.use(express.json({ limit: "10mb" }));

app.use(authRoutes);
app.use(userRouter);
app.use(barberRouter);
app.use(appointmentRouter);
app.use(blockedDateRouter);
app.use(subscriptionPlanRouter);
app.use(subscriptionRouter);
app.use(paymentRouter);
app.use(paymentMethodRouter);
app.use(galleryRouter);
app.use(productsRouter);
app.use(serviceRouter);
app.use(settingsRouter);
app.use(dependentRouter);
app.use(savedCardRouter);
app.use(employeeValeRouter);
app.use(employeePaymentRouter);
app.use(superAdminRouter);
app.use(dashboardRouter);
app.use(platformPlanRouter);
app.use(cashClosingRouter);
app.use(areschatSetupRouter);
app.use(areschatIntegrationRouter);
app.use("/pagarme", pagarmeRoutes);
app.use('/pagarme/subscriptions', pagarmeSubs);
app.use(errorHandler);


const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});
