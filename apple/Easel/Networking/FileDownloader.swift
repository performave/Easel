import AppKit
import Observation
import SwiftUI

/// In-app file downloads with live progress, replacing the Rust
/// `download_and_open_file` / `download_file_to` commands. Streams the file via
/// `URLSession` (seeded with the Canvas session cookies for non-presigned URLs),
/// reports a 0...1 fraction per file, and can open or reveal the result.
@MainActor
@Observable
final class FileDownloader {
    struct Download: Identifiable {
        let id: Int
        var filename: String
        /// nil = indeterminate (server sent no Content-Length).
        var fraction: Double?
        var finishedURL: URL?
        var failed = false
    }

    private(set) var tasks: [Int: Download] = [:]

    func task(for fileId: Int) -> Download? { tasks[fileId] }
    func isActive(_ fileId: Int) -> Bool {
        guard let t = tasks[fileId] else { return false }
        return t.finishedURL == nil && !t.failed
    }

    /// Download `fileId` to a temporary location and open it. Returns when done.
    @discardableResult
    func downloadAndOpen(fileId: Int) async -> URL? {
        guard let url = await download(fileId: fileId, savePanel: false) else { return nil }
        NSWorkspace.shared.open(url)
        return url
    }

    /// Download `fileId`, prompting the user for a save location first.
    func downloadAs(fileId: Int) async {
        _ = await download(fileId: fileId, savePanel: true)
    }

    func reveal(_ url: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    // MARK: - Core

    private func download(fileId: Int, savePanel: Bool) async -> URL? {
        let meta = try? await CanvasClient.shared.fileMeta(fileId)
        let filename = sanitize(meta?.displayName ?? meta?.filename ?? "download")
        guard let urlString = meta?.url, let remoteURL = URL(string: urlString) else {
            tasks[fileId] = Download(id: fileId, filename: filename, fraction: nil, failed: true)
            return nil
        }

        // Choose destination up front for "Save As", or temp dir otherwise.
        var destination: URL
        if savePanel {
            guard let chosen = presentSavePanel(suggested: filename) else { return nil }
            destination = chosen
        } else {
            destination = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        }

        tasks[fileId] = Download(id: fileId, filename: filename, fraction: 0)

        let cookies = await CanvasClient.shared.currentCookies()
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage?.setCookies(cookies, for: remoteURL, mainDocumentURL: nil)
        let delegate = ProgressDelegate { [weak self] fraction in
            Task { @MainActor in self?.tasks[fileId]?.fraction = fraction }
        }
        let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }

        do {
            let (tempURL, _) = try await session.download(from: remoteURL)
            try? FileManager.default.removeItem(at: destination)
            try FileManager.default.moveItem(at: tempURL, to: destination)
            tasks[fileId]?.fraction = 1
            tasks[fileId]?.finishedURL = destination
            return destination
        } catch {
            tasks[fileId]?.failed = true
            return nil
        }
    }

    private func presentSavePanel(suggested: String) -> URL? {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggested
        panel.canCreateDirectories = true
        return panel.runModal() == .OK ? panel.url : nil
    }

    private func sanitize(_ name: String) -> String {
        (name as NSString).lastPathComponent.replacingOccurrences(of: "/", with: "_")
    }
}

/// Bridges `URLSessionDownloadDelegate` byte-count callbacks into a progress
/// fraction. Runs on a background delegate queue; the closure hops to the main
/// actor.
private final class ProgressDelegate: NSObject, URLSessionDownloadDelegate {
    private let onProgress: (Double?) -> Void
    init(onProgress: @escaping (Double?) -> Void) { self.onProgress = onProgress }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64, totalBytesWritten: Int64,
                    totalBytesExpectedToWrite: Int64) {
        if totalBytesExpectedToWrite > 0 {
            onProgress(Double(totalBytesWritten) / Double(totalBytesExpectedToWrite))
        } else {
            onProgress(nil)
        }
    }

    // Required by the protocol; the async `download(from:)` consumes the file.
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {}
}
