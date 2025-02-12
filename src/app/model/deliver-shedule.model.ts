export interface deliveryGasDTO {
    gasId:number;
    quantity:number;
}

export interface deliverShedule{
    id: number;
    deliveryDate: string;
    status: string;
    outletId: number;
    qty: string;
    deliveryGasDTOS:deliveryGasDTO[];
}