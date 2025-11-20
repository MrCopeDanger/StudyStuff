// types/CurrentUser.d.ts
declare global {
  interface CurrentUser {
    id: number
    name: string
    username: string
    email: string
  }
}
export {}
