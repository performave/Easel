import SwiftUI

/// Domain entry + SSO launcher. Redesigned natively (a centered card rather than
/// the React split-panel), but functionally identical: enter a Canvas domain, a
/// web window opens for SSO, cookies are harvested on success.
struct LoginView: View {
    @Environment(AuthManager.self) private var auth

    @State private var domain = "canvas.duke.edu"
    @State private var errorMessage: String?

    private var isPresentingLogin: Binding<Bool> {
        Binding(
            get: { auth.pendingLogin != nil },
            set: { if !$0 { auth.cancelLogin() } }
        )
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.accentColor)
                    .frame(width: 56, height: 56)
                    .overlay(Text("E").font(.system(size: 28, weight: .bold)).foregroundStyle(.white))
                Text("Easel")
                    .font(.largeTitle.bold())
                Text("A calmer way to do Canvas.")
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Canvas domain")
                    .font(.callout.weight(.medium))
                TextField("canvas.yourschool.edu", text: $domain)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(submit)
                Text("A browser window will open for single sign-on.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                Button(action: submit) {
                    Text("Continue")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(domain.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .frame(width: 320)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
        .sheet(isPresented: isPresentingLogin) {
            if let request = auth.pendingLogin {
                LoginSheet(domain: request.domain)
            }
        }
    }

    private func submit() {
        errorMessage = nil
        do {
            try auth.startLogin(domain: domain)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Modal wrapper around `LoginWebView` with a cancel control and a busy state
/// while the harvested session is being persisted.
private struct LoginSheet: View {
    @Environment(AuthManager.self) private var auth
    let domain: String

    @State private var finishing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Sign in to \(domain)")
                    .font(.headline)
                Spacer()
                if finishing { ProgressView().controlSize(.small) }
                Button("Cancel") { auth.cancelLogin() }
            }
            .padding(12)
            Divider()

            if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .padding()
            }

            LoginWebView(domain: domain, onComplete: handleComplete)
        }
        .frame(width: 960, height: 760)
    }

    private func handleComplete(_ result: Result<Session, Error>) {
        switch result {
        case .success(let session):
            finishing = true
            Task {
                do { try await auth.completeLogin(session) }
                catch {
                    errorMessage = error.localizedDescription
                    finishing = false
                }
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }
}
