export type Role='super_admin'|'city_admin'|'handler';
export type EventStatus='draft'|'upcoming'|'active'|'completed'|'cancelled'|'archived';
export type City={id:string;name:string;code:string;active:boolean};
export type EventRecord={id:string;event_code:string;name:string;type:string;activity_id:string|null;activity_name?:string|null;activity?:{name:string}|null;client_name:string|null;event_date:string;expected_arrival_time:string|null;venue:string;address:string;city:string;city_id:string|null;status:EventStatus;required_handlers:number;cities?:{name:string;code:string}|null};
