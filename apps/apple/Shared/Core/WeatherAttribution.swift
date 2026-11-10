import SwiftUI

/// Apple Weather attribution, required wherever WeatherKit data is shown. Appears only when the snapshot says
/// city temperatures came from WeatherKit (the weather switch, docs/weatherkit.md); with Open-Meteo it draws nothing.
struct AppleWeatherMark: View {
    let data: EarthReadings
    var size: CGFloat = 12
    var body: some View {
        if data.isAppleWeather {
            HStack(spacing: 6) {
                AsyncImage(url: data.weatherLogo) { img in
                    img.resizable().scaledToFit().frame(height: size)
                } placeholder: {
                    Text("\u{F8FF} Weather").font(.system(size: size, weight: .semibold))
                }
                .accessibilityLabel("Apple Weather")
                #if os(tvOS)
                Text("Other data sources: weatherkit.apple.com/legal-attribution.html").font(.system(size: size * 0.9))
                #else
                Link("Other data sources", destination: data.weatherLegal).font(.system(size: size * 0.9))
                #endif
            }
            .foregroundStyle(Theme.mute)
        }
    }
}
