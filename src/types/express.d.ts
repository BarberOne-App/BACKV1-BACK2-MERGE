// import "express";

// declare global {
//   namespace Express {
//     interface User {
//       id: string;
//       role: "admin" | "barber" | "client";
//       isAdmin: boolean;
//       name: string;
//       email: string | null;
//     }

//     interface Request {
//       user?: User;
//     }
//   }
// }

// export {};


import "express";

declare global {
  namespace Express {
    interface User {
      id: string; // uuid
      barbershopId: string; // uuid
      role: string;
      isAdmin: boolean;
      name: string;
      email: string;
      permissions?: Record<string, boolean>;
    }
    interface Request {
      user?: User;
    }
  }
}

export {};
