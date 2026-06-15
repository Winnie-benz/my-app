export type NotifyType = 'success' | 'error' | 'warning'

export type NotifyDetail = {
  type: NotifyType
  message: string
}

export function notify(type: NotifyType, message: string) {
  window.dispatchEvent(new CustomEvent<NotifyDetail>('app-notify', {
    detail: { type, message },
  }))
}
