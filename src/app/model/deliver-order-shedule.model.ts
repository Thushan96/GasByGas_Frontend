import { deliveryGasDTO } from "./deliver-shedule.model";

export interface deliverOrderShedule{
    deliveryScheduleId: number;
    deliveredGases:deliveryGasDTO[];
}