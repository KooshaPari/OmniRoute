//! Thermal governor — reads system thermal/memory pressure before scheduling work.

/// System thermal pressure level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThermalLevel {
    Green,
    Yellow,
    Red,
}

#[derive(Debug, Default, Clone)]
pub struct ThermalGovernor {
    _private: (),
}

impl ThermalGovernor {
    pub fn new() -> Self {
        Self { _private: () }
    }

    pub fn poll(&self) -> anyhow::Result<ThermalLevel> {
        self.poll_impl()
    }

    #[cfg(target_os = "macos")]
    fn poll_impl(&self) -> anyhow::Result<ThermalLevel> {
        let output = std::process::Command::new("sysctl")
            .arg("-n")
            .arg("kern.memorystatus_vm_pressure_level")
            .output()?;
        let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
        match raw.as_str() {
            "1" => Ok(ThermalLevel::Green),
            "2" => Ok(ThermalLevel::Yellow),
            "4" => Ok(ThermalLevel::Red),
            other => anyhow::bail!("unexpected pressure level: {other}"),
        }
    }

    #[cfg(target_os = "linux")]
    fn poll_impl(&self) -> anyhow::Result<ThermalLevel> {
        let contents = std::fs::read_to_string("/sys/class/thermal/thermal_zone0/temp")?;
        let millidegrees: u64 = contents.trim().parse()?;
        Ok(match millidegrees {
            t if t < 70_000 => ThermalLevel::Green,
            t if t < 85_000 => ThermalLevel::Yellow,
            _ => ThermalLevel::Red,
        })
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    fn poll_impl(&self) -> anyhow::Result<ThermalLevel> {
        Ok(ThermalLevel::Green)
    }
}
