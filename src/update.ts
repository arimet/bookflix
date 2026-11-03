// A new version of the app took over. Reloading at once (the plugin's default) cut downloads short and pulled
// the page from under the reader: the app reloads at its next change of screen, with no download running.
let pending = false
export const updateReady = () => {
  pending = true
}
export const reloadIfUpdated = () => pending && location.reload()
