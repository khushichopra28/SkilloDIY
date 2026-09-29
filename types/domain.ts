export type Role='super_admin'|'city_admin'|'handler';
export type EventStatus='draft'|'upcoming'|'active'|'completed'|'cancelled'|'archived';
export type City={id:string;name:string;code:string;active:boolean};
export type EventRecord={id:string;event_code:string;name:string;type:string;event_date:string;start_time:string;end_time:string;venue:string;address:string;city:string;city_id:string;status:EventStatus;required_handlers:number;cities?:{name:string;code:string}|null};
export type EventDraft={name:string;type:string;activity_id:string|null;client_id:string|null;description:string;city_id:string;date:string;start_time:string;end_time:string;venue:string;address:string;venue_access_time:string;expected_arrival_time:string;expected_participants:number|null;age_group:string;theme:string;status:'draft'|'upcoming'};
