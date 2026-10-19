import type { Express } from 'express';
import type { Access } from './access.js';
import { getActor } from './actor.js';
import type { Dependencies } from './dependencies.js';
import { breakdownSchema, vehicleInspectionSchema } from './schemas.js';
import { apiRoutes } from './routes.js';

export function registerVehicleReportRoutes(
  app: Express,
  deps: Pick<Dependencies, 'vehicleReports'>,
  access: Pick<Access, 'authenticate' | 'admin'>,
) {
  app.get(apiRoutes.driver.inspections, access.authenticate, async (_req, res) =>
    res.json(await deps.vehicleReports.driverReports(getActor(res))),
  );
  app.post(apiRoutes.driver.inspections, access.authenticate, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.vehicleReports.submitInspection(
          getActor(res),
          vehicleInspectionSchema.parse(req.body),
        ),
      ),
  );
  app.post(apiRoutes.driver.breakdowns, access.authenticate, async (req, res) =>
    res
      .status(201)
      .json(
        await deps.vehicleReports.reportBreakdown(getActor(res), breakdownSchema.parse(req.body)),
      ),
  );
  app.get(apiRoutes.vehicleReports, access.authenticate, access.admin, async (_req, res) =>
    res.json(await deps.vehicleReports.adminReports(getActor(res))),
  );
}
