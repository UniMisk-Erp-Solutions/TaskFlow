import 'dart:async';

import 'package:flutter/material.dart';

/// Re-renders only [builder] every second while [running] is true, counting up from [base] seconds.
///
/// Keeping the one-second tick inside this tiny widget means the surrounding screen never rebuilds
/// because of a running timer, which is what keeps lists smooth.
class LiveSeconds extends StatefulWidget {
  const LiveSeconds({super.key, required this.base, required this.running, required this.builder});
  final int base;
  final bool running;
  final Widget Function(BuildContext context, int seconds) builder;

  @override
  State<LiveSeconds> createState() => _LiveSecondsState();
}

class _LiveSecondsState extends State<LiveSeconds> {
  Timer? _timer;
  late DateTime _anchor = DateTime.now();

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(covariant LiveSeconds old) {
    super.didUpdateWidget(old);
    if (old.base != widget.base || old.running != widget.running) {
      _anchor = DateTime.now();
      _sync();
    }
  }

  void _sync() {
    _timer?.cancel();
    _timer = null;
    if (widget.running) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final extra = widget.running ? DateTime.now().difference(_anchor).inSeconds : 0;
    return widget.builder(context, widget.base + extra);
  }
}

/// Counts down to [until] with its own ticker and calls [onDone] once when it reaches zero.
class Countdown extends StatefulWidget {
  const Countdown({super.key, required this.until, required this.builder, this.onDone});
  final DateTime until;
  final Widget Function(BuildContext context, Duration left) builder;
  final VoidCallback? onDone;

  @override
  State<Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<Countdown> {
  Timer? _timer;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (!widget.until.isAfter(DateTime.now())) {
        _timer?.cancel();
        if (!_done) {
          _done = true;
          widget.onDone?.call();
        }
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.until.difference(DateTime.now());
    return widget.builder(context, left.isNegative ? Duration.zero : left);
  }
}

/// Pulsing placeholder block used while data loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 10});
  final double height;
  final double? width;
  final double radius;
  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.onSurface;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: base.withValues(alpha: 0.06 + 0.06 * _c.value),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// A list of card-shaped skeletons.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      for (var i = 0; i < count; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                Skeleton(height: 18, width: 220),
                SizedBox(height: 12),
                Skeleton(height: 12, width: 120),
                SizedBox(height: 10),
                Skeleton(height: 12),
              ]),
            ),
          ),
        ),
    ]);
  }
}
